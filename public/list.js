<<<<<<< HEAD
\n// このファイルは app.js の後に読み込まれる想定です。\n// app.jsで初期化済みのfirebaseオブジェクトを使用します。\n\nprotectPage((user) => {\n    // --- DOM要素 --- \n    const userNameDisplay = document.getElementById('user-name-display');\n    const cardListContainer = document.getElementById('card-list-container');\n    const loadMoreButton = document.getElementById('load-more-button');\n    const searchButton = document.getElementById('search-button');\n    const searchKeyword = document.getElementById('search-keyword');\n\n    // --- グローバル変数 --- \n    const db = firebase.firestore();\n    let lastVisibleDoc = null; // ページネーション用\n    let currentKeyword = '';   // 現在の検索キーワード\n    const CARDS_PER_PAGE = 10; // 1ページあたりの表示件数\n\n    // --- 初期表示 --- \n    if (userNameDisplay) {\n        userNameDisplay.textContent = user.displayName || 'ゲスト';\n    }\n    fetchCards(true); // 最初のカードリストを読み込み\n\n    // --- 関数定義 --- \n\n    /**\n     * Firestoreから名刺データを取得して画面に表示する\n     * @param {boolean} isInitialLoad - 初期読み込みかどうか\n     * @param {string} keyword - 検索キーワード\n     */\n    async function fetchCards(isInitialLoad = false, keyword = '') {\n        if (isInitialLoad) {\n            cardListContainer.innerHTML = ''; // コンテナをクリア\n            lastVisibleDoc = null;\n        }\n\n        showLoading(true);\n\n        try {\n            let query = db.collection('business_cards')\n                        .where('user_id', '==', user.uid)\n                        .where('isDeleted', '!=', true); // 論理削除されていないもののみ取得\n\n            // ▼▼▼ 検索ロジックを前方一致検索に変更 ▼▼▼\n            if (keyword) {\n                // 'name'フィールドで前方一致検索\n                query = query.where('name', '>=', keyword)\n                             .where('name', '<=', keyword + '\\uf8ff')\n                             .orderBy('name'); // 前方一致検索では、そのフィールドでの並べ替えが必須\n            } else {\n                // キーワードがない場合は、作成日時の降順で並び替える\n                query = query.orderBy('createdAt', 'desc');\n            }\n            // ▲▲▲ 変更ここまで ▲▲▲\n\n            // ページネーション\n            if (lastVisibleDoc && !isInitialLoad) {\n                query = query.startAfter(lastVisibleDoc);\n            }\n            \n            query = query.limit(CARDS_PER_PAGE);\n\n            const snapshot = await query.get();\n\n            if (snapshot.empty && isInitialLoad) {\n                cardListContainer.innerHTML = '<p class=\"col-span-full text-center text-gray-500\">該当する名刺は見つかりませんでした。</p>';\n                loadMoreButton.classList.add('hidden');\n                showLoading(false);\n                return;\n            }\n            \n            if (isInitialLoad && cardListContainer.querySelector('.animate-pulse')) {\n                cardListContainer.innerHTML = '';\n            }\n\n            snapshot.forEach(doc => {\n                const cardElement = createCardElement(doc.id, doc.data());\n                cardListContainer.appendChild(cardElement);\n            });\n\n            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];\n\n            if(snapshot.docs.length < CARDS_PER_PAGE){\n                loadMoreButton.classList.add('hidden');\n            } else {\n                loadMoreButton.classList.remove('hidden');\n            }\n\n        } catch (error) {\n            console.error(\"Error fetching cards: \", error);\n            if (error.code === 'failed-precondition') {\n                // Firestoreがインデックスの作成を要求している場合のエラーハンドリング\n                const indexCreationUrl = error.message.match(/(https?:\/\/[^\\s]*)/);\n                let errorMessage = '検索を実行するには、データベースのインデックス作成が必要です。';\n                if (indexCreationUrl && indexCreationUrl[0]) {\n                    errorMessage += `<br><a href=\"${indexCreationUrl[0]}\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-blue-600 hover:underline\">こちらのリンクをクリックしてインデックスを作成してください。</a><br>作成には数分かかる場合があります。`;\n                } else {\n                     errorMessage += 'Firebaseコンソールで手動でインデックスを作成してください。'\n                }\n                cardListContainer.innerHTML = `<p class=\"col-span-full text-center text-red-500\">${errorMessage}</p>`;\n\n            } else {\n                cardListContainer.innerHTML = '<p class=\"col-span-full text-center text-red-500\">データの読み込みに失敗しました。コンソールを確認してください。</p>';\n            }\n        } finally {\n            showLoading(false);\n        }\n    }\n\n    /**\n     * 名刺カードのHTML要素を作成する\n     */\n    function createCardElement(id, data) {\n        const cardLink = document.createElement('a');\n        cardLink.href = `/business_card_detail.html?id=${id}`;\n        cardLink.className = \"block bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow duration-200\";\n        cardLink.innerHTML = `\n            <div class=\"p-2\">\n                <p class=\"text-sm text-gray-600 truncate\">${data.company || ''}</p>\n                <h3 class=\"font-bold text-lg truncate\">${data.name || ''}</h3>\n                <p class=\"text-sm text-gray-500 truncate\">${data.department || ''}</p>\n            </div>\n        `;\n        return cardLink;\n    }\n\n    /**\n     * 読み込みボタンの状態を更新する\n     */\n    function showLoading(isLoading) {\n        if (isLoading) {\n            loadMoreButton.disabled = true;\n            loadMoreButton.textContent = '読み込み中...';\n        } else {\n            loadMoreButton.disabled = false;\n            loadMoreButton.textContent = 'もっと見る';\n        }\n    }\n\n    // --- イベントリスナー --- \n\n    searchButton.addEventListener('click', () => {\n        currentKeyword = searchKeyword.value;\n        fetchCards(true, currentKeyword);\n    });\n    \n    searchKeyword.addEventListener('keydown', (event) => {\n        if (event.key === 'Enter') {\n            currentKeyword = searchKeyword.value;\n            fetchCards(true, currentKeyword);\n        }\n    });\n\n    loadMoreButton.addEventListener('click', () => {\n        fetchCards(false, currentKeyword);\n    });\n});\n
=======
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const cardListContainer = document.getElementById('card-list-container');
    const searchButton = document.getElementById('search-button');
    const searchKeyword = document.getElementById('search-keyword');
    const toggleAdvancedBtn = document.getElementById('toggle-advanced-search');
    const advancedPanel = document.getElementById('advanced-search-panel');
    const searchDepartment = document.getElementById('search-department');
    const searchEmail = document.getElementById('search-email');
    const searchAddress = document.getElementById('search-address');
    const exportCsvBtn = document.getElementById('export-csv-button');
    const scrollSentinel = document.getElementById('scroll-sentinel');
    const loadingMoreSpinner = document.getElementById('loading-more-spinner');

    let allCards = []; // インメモリフィルタリング用の全データ保持
    let currentFilteredCards = []; // 現在の検索条件に合致するデータ
    let displayedCount = 0; // 現在画面に表示されている件数
    const CARDS_PER_PAGE = 20; // 1回のスクロールで読み込む件数
    let observer; // IntersectionObserver

    // 詳細検索の開閉トグル
    if (toggleAdvancedBtn) {
        toggleAdvancedBtn.addEventListener('click', () => {
            advancedPanel.classList.toggle('hidden');
            if (advancedPanel.classList.contains('hidden')) {
                toggleAdvancedBtn.innerHTML = '<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>詳細検索（フィルター）を開く';
            } else {
                toggleAdvancedBtn.innerHTML = '<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>詳細検索を閉じる';
            }
        });
    }

    // 認証監視
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            const userNameDisplay = document.getElementById('user-name-display');
            if (userNameDisplay) userNameDisplay.textContent = user.displayName || user.email;
            fetchAllCards();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Firestoreから全データを取得
    async function fetchAllCards() {
        if (!cardListContainer) return;
        
        cardListContainer.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                <p class="text-gray-500 mt-4 font-semibold">名刺データを読み込み中...</p>
            </div>
        `;

        try {
            const snapshot = await db.collection('businessCards').orderBy('createdAt', 'desc').get();
            
            allCards = [];
            snapshot.forEach(doc => {
                if (!doc.data().deletedAt) {
                    allCards.push({ id: doc.id, ...doc.data() });
                }
            });

            currentFilteredCards = [...allCards];
            displayedCount = 0;
            cardListContainer.innerHTML = '';
            
            loadMoreCards();
            setupIntersectionObserver();
            
        } catch (error) {
            console.error("Error fetching cards:", error);
            cardListContainer.innerHTML = '<p class="col-span-full text-center text-red-500 font-bold py-8">データの読み込みに失敗しました。</p>';
        }
    }

    // 無限スクロール用の監視セットアップ
    function setupIntersectionObserver() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMoreCards();
            }
        }, { rootMargin: '100px' });
        
        if (scrollSentinel) observer.observe(scrollSentinel);
    }

    // 追加のカードを読み込んで描画する（ページネーション）
    function loadMoreCards() {
        if (!cardListContainer) return;
        
        if (displayedCount >= currentFilteredCards.length) {
            if (loadingMoreSpinner) loadingMoreSpinner.classList.add('hidden');
            return;
        }

        if (loadingMoreSpinner) loadingMoreSpinner.classList.remove('hidden');

        const nextBatch = currentFilteredCards.slice(displayedCount, displayedCount + CARDS_PER_PAGE);
        
        if (displayedCount === 0 && nextBatch.length === 0) {
            cardListContainer.innerHTML = `
                <div class="col-span-full text-center bg-white rounded-xl shadow-sm border border-gray-200 py-12">
                    <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-gray-500 text-lg font-semibold">条件に一致する名刺が見つかりません</p>
                </div>
            `;
            if (loadingMoreSpinner) loadingMoreSpinner.classList.add('hidden');
            return;
        }

        nextBatch.forEach(card => {
            const el = document.createElement('a');
            el.href = `/business_card_detail.html?id=${card.id}`;
            el.className = "block bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition transform duration-200 overflow-hidden";
            
            const imgSrc = card.imageUrl ? card.imageUrl : "https://placehold.jp/300x150.png?text=No+Image";
            
            el.innerHTML = `
                <div class="h-40 bg-gray-100 overflow-hidden border-b border-gray-100 relative">
                    <img src="${imgSrc}" alt="名刺画像" class="w-full h-full object-cover">
                </div>
                <div class="p-5">
                    <p class="text-xs text-blue-600 font-bold mb-1 truncate">${card.companyName || '会社名未登録'}</p>
                    <h3 class="font-bold text-xl text-gray-800 truncate mb-1">${card.name || '氏名未登録'}</h3>
                    <p class="text-xs text-gray-500 truncate">${[card.department, card.position].filter(Boolean).join(' ') || '部署・役職未登録'}</p>
                </div>
            `;
            cardListContainer.appendChild(el);
        });

        displayedCount += nextBatch.length;
        if (loadingMoreSpinner) {
            if (displayedCount >= currentFilteredCards.length) {
                loadingMoreSpinner.classList.add('hidden');
            } else {
                loadingMoreSpinner.classList.remove('hidden');
            }
        }
    }

    // 検索フィルタリング実行
    function performSearch() {
        if (!allCards.length) return;

        const keyword = searchKeyword.value.toLowerCase();
        const dep = searchDepartment.value.toLowerCase();
        const email = searchEmail.value.toLowerCase();
        const address = searchAddress.value.toLowerCase();

        currentFilteredCards = allCards.filter(card => {
            const matchKeyword = !keyword || 
                (card.name && card.name.toLowerCase().includes(keyword)) ||
                (card.companyName && card.companyName.toLowerCase().includes(keyword));
            
            const matchDep = !dep || 
                (card.department && card.department.toLowerCase().includes(dep)) ||
                (card.position && card.position.toLowerCase().includes(dep));
                
            const matchEmail = !email || (card.email && card.email.toLowerCase().includes(email));
            const matchAddress = !address || (card.address && card.address.toLowerCase().includes(address));

            return matchKeyword && matchDep && matchEmail && matchAddress;
        });

        cardListContainer.innerHTML = '';
        displayedCount = 0;
        loadMoreCards();
    }

    // CSVエクスポート実行
    function exportCsv() {
        // 未ロード分も含め、現在のフィルタ条件に合致する「全件」を出力対象とする
        const targetData = currentFilteredCards && currentFilteredCards.length > 0 ? currentFilteredCards : allCards;

        if (!targetData || targetData.length === 0) {
            alert("エクスポートするデータがありません。");
            return;
        }

        // BOM付きUTF-8で文字化け防止
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        
        // ヘッダー行の固定化
        const headers = ['氏名', '会社名', '部署名', '役職', '電話番号', '携帯電話', 'FAX', 'Email', '住所', '登録日時', 'メモ'];
        let csvContent = headers.join(',') + '\n';

        // サニタイズ関数（CSV Injection対策）
        const sanitize = (str) => {
            if (!str) return '""';
            let cleanStr = String(str).replace(/"/g, '""'); // ダブルクォートのエスケープ
            // 先頭が =, +, -, @ または制御文字の場合はシングルクォートを付与
            if (/^[=+\-@\u202E]/.test(cleanStr)) {
                cleanStr = "'" + cleanStr;
            }
            return `"${cleanStr}"`;
        };

        // データ行
        targetData.forEach(card => {
            let createdAtStr = "";
            if (card.createdAt && card.createdAt.toMillis) {
                createdAtStr = new Date(card.createdAt.toMillis()).toLocaleString();
            } else if (card.createdAt) {
                createdAtStr = new Date(card.createdAt).toLocaleString();
            }

            const row = [
                sanitize(card.name),
                sanitize(card.companyName),
                sanitize(card.department),
                sanitize(card.position),
                sanitize(card.companyPhone),
                sanitize(card.mobilePhone),
                sanitize(card.fax),
                sanitize(card.email),
                sanitize(card.address),
                sanitize(createdAtStr),
                sanitize(card.memo)
            ];
            csvContent += row.join(',') + '\n';
        });

        // ダウンロード処理
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `bizknot_cards_${dateStr}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // イベントバインド
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

    if (searchButton) searchButton.addEventListener('click', performSearch);
    
    const inputs = [searchKeyword, searchDepartment, searchEmail, searchAddress];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('keydown', (e) => { 
                if(e.key === 'Enter') performSearch(); 
            });
        }
    });
});
>>>>>>> feature/ocr-implementation
