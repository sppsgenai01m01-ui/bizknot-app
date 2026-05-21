// このファイルは app.js の後に読み込まれる想定です。
// app.jsで初期化済みのfirebaseオブジェクトを使用します。

protectPage((user) => {
    // --- DOM要素 --- 
    const userNameDisplay = document.getElementById('user-name-display');
    const cardListContainer = document.getElementById('card-list-container');
    const loadMoreButton = document.getElementById('load-more-button');
    const searchButton = document.getElementById('search-button');
    const searchKeyword = document.getElementById('search-keyword');

    // --- グローバル変数 --- 
    const db = firebase.firestore();
    let lastVisibleDoc = null; // ページネーション用
    let currentKeyword = '';   // 現在の検索キーワード
    const CARDS_PER_PAGE = 10; // 1ページあたりの表示件数

    // --- 初期表示 --- 
    if (userNameDisplay) {
        userNameDisplay.textContent = user.displayName || 'ゲスト';
    }
    fetchCards(true); // 最初のカードリストを読み込み

    // --- 関数定義 --- 

    /**
     * Firestoreから名刺データを取得して画面に表示する
     * @param {boolean} isInitialLoad - 初期読み込みかどうか
     * @param {string} keyword - 検索キーワード
     */
    async function fetchCards(isInitialLoad = false, keyword = '') {
        if (isInitialLoad) {
            cardListContainer.innerHTML = ''; // コンテナをクリア
            lastVisibleDoc = null;
        }

        showLoading(true);

        try {
            let query = db.collection('business_cards');

            // ▼▼▼ 検索と並び替えのロジックを修正 ▼▼▼
            if (keyword) {
                // キーワード検索を行う場合、Firestoreの制約により、検索対象のフィールドで最初に並び替える必要がある
                query = query.where('name', '>=', keyword)
                             .where('name', '<=', keyword + '\uf8ff')
                             .orderBy('name', 'asc')
                             .orderBy('createdAt', 'desc'); // 第二の並び替えキーとして作成日時を指定
            } else {
                // キーワードがない場合は、作成日時の降順で並び替える
                query = query.orderBy('createdAt', 'desc');
            }
            // ▲▲▲ 修正ここまで ▲▲▲

            // ページネーション
            if (lastVisibleDoc && !isInitialLoad) {
                query = query.startAfter(lastVisibleDoc);
            }
            
            query = query.limit(CARDS_PER_PAGE);

            const snapshot = await query.get();

            if (snapshot.empty && isInitialLoad) {
                cardListContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">該当する名刺は見つかりませんでした。</p>';
                loadMoreButton.classList.add('hidden');
                showLoading(false);
                return;
            }
            
            // スケルトン表示をクリア
            if (isInitialLoad && cardListContainer.querySelector('.animate-pulse')) {
                cardListContainer.innerHTML = '';
            }

            snapshot.forEach(doc => {
                const cardElement = createCardElement(doc.id, doc.data());
                cardListContainer.appendChild(cardElement);
            });

            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

            // 次のページがあるかどうかを判断
            if(snapshot.docs.length < CARDS_PER_PAGE){
                loadMoreButton.classList.add('hidden');
            } else {
                loadMoreButton.classList.remove('hidden');
            }

        } catch (error) {
            console.error("Error fetching cards: ", error);
            if (error.code === 'failed-precondition') {
                // 複合インデックスが必要な場合のエラー
                cardListContainer.innerHTML = '<p class="col-span-full text-center text-red-500">検索機能の有効化に失敗しました。詳細はブラウザのコンソールを確認し、表示されたリンクからインデックスを作成してください。</p>';
            } else {
                cardListContainer.innerHTML = '<p class="col-span-full text-center text-red-500">データの読み込みに失敗しました。コンソールを確認してください。</p>';
            }
        } finally {
            showLoading(false);
        }
    }

    /**
     * 名刺カードのHTML要素を作成する
     */
    function createCardElement(id, data) {
        const cardLink = document.createElement('a');
        cardLink.href = `/business_card_detail.html?id=${id}`;
        cardLink.className = "block bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow duration-200";
        cardLink.innerHTML = `
            <div class="p-2">
                <p class="text-sm text-gray-600 truncate">${data.company || ''}</p>
                <h3 class="font-bold text-lg truncate">${data.name || ''}</h3>
                <p class="text-sm text-gray-500 truncate">${data.department || ''}</p>
            </div>
        `;
        return cardLink;
    }

    /**
     * 読み込みボタンの状態を更新する
     */
    function showLoading(isLoading) {
        if (isLoading) {
            loadMoreButton.disabled = true;
            loadMoreButton.textContent = '読み込み中...';
        } else {
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = 'もっと見る';
        }
    }

    // --- イベントリスナー --- 

    searchButton.addEventListener('click', () => {
        currentKeyword = searchKeyword.value;
        fetchCards(true, currentKeyword);
    });
    
    searchKeyword.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            currentKeyword = searchKeyword.value;
            fetchCards(true, currentKeyword);
        }
    });

    loadMoreButton.addEventListener('click', () => {
        fetchCards(false, currentKeyword);
    });
});
