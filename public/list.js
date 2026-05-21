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
            let query = db.collection('business_cards')
                        .orderBy('createdAt', 'desc')
                        .limit(CARDS_PER_PAGE);

            // キーワード検索（前方一致）
            if (keyword) {
                // 注: Firestoreのネイティブ機能では部分一致検索は効率的ではないため、
                // ここでは'name'と'company'の前方一致のみを簡易的に実装します。
                // より高度な検索にはAlgolia等の専門サービスが必要です。
                query = query.where('name', '>=', keyword).where('name', '<=', keyword + '\uf8ff');
                // 必要であれば会社名も検索対象に加えるなどの拡張が可能
            }
            
            // ページネーション
            if (lastVisibleDoc && !isInitialLoad) {
                query = query.startAfter(lastVisibleDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty && isInitialLoad) {
                cardListContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">名刺はまだ登録されていません。</p>';
                loadMoreButton.classList.add('hidden');
                return;
            }
            
            snapshot.forEach(doc => {
                const cardElement = createCardElement(doc.id, doc.data());
                // スケルトン表示を置換
                if (isInitialLoad && cardListContainer.querySelector('.animate-pulse')) {
                    cardListContainer.innerHTML = '';
                }
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
            cardListContainer.innerHTML = '<p class="col-span-full text-center text-red-500">データの読み込みに失敗しました。コンソールを確認してください。</p>';
        } finally {
            showLoading(false);
        }
    }

    /**
     * 名刺カードのHTML要素を作成する
     * @param {string} id - ドキュメントID
     * @param {object} data - 名刺データ
     * @returns {HTMLElement} aタグで囲まれたカード要素
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
     * @param {boolean} isLoading - 読み込み中かどうか
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

    // 検索ボタン
    searchButton.addEventListener('click', () => {
        currentKeyword = searchKeyword.value;
        fetchCards(true, currentKeyword);
    });
    
    // Enterキーでの検索
    searchKeyword.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            currentKeyword = searchKeyword.value;
            fetchCards(true, currentKeyword);
        }
    });

    // もっと見るボタン
    loadMoreButton.addEventListener('click', () => {
        fetchCards(false, currentKeyword);
    });
});
