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

    let allCards = []; // インメモリフィルタリング用の全データ保持

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
        
        // ローディング表示
        cardListContainer.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                <p class="text-gray-500 mt-4 font-semibold">名刺データを読み込み中...</p>
            </div>
        `;

        try {
            // ※注意: FirestoreはRDBのような柔軟なLIKE検索ができないため、
            // MVP版として全件取得し、JavaScript側で複数条件フィルタリングを行う設計とする
            const snapshot = await db.collection('businessCards').orderBy('createdAt', 'desc').get();
            
            allCards = [];
            snapshot.forEach(doc => {
                if (!doc.data().deletedAt) {
                    allCards.push({ id: doc.id, ...doc.data() });
                }
            });

            renderCards(allCards);
        } catch (error) {
            console.error("Error fetching cards:", error);
            cardListContainer.innerHTML = '<p class="col-span-full text-center text-red-500 font-bold py-8">データの読み込みに失敗しました。</p>';
        }
    }

    // カードを画面に描画
    function renderCards(cardsToRender) {
        if (!cardListContainer) return;
        cardListContainer.innerHTML = '';
        
        if (cardsToRender.length === 0) {
            cardListContainer.innerHTML = `
                <div class="col-span-full text-center bg-white rounded-xl shadow-sm border border-gray-200 py-12">
                    <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-gray-500 text-lg font-semibold">条件に一致する名刺が見つかりません</p>
                </div>
            `;
            return;
        }

        cardsToRender.forEach(card => {
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
    }

    // 検索フィルタリング実行
    function performSearch() {
        if (!allCards.length) return;

        const keyword = searchKeyword.value.toLowerCase();
        const dep = searchDepartment.value.toLowerCase();
        const email = searchEmail.value.toLowerCase();
        const address = searchAddress.value.toLowerCase();

        const filtered = allCards.filter(card => {
            // 基本キーワード（会社名 or 氏名）
            const matchKeyword = !keyword || 
                (card.name && card.name.toLowerCase().includes(keyword)) ||
                (card.companyName && card.companyName.toLowerCase().includes(keyword));
            
            // 詳細検索
            const matchDep = !dep || 
                (card.department && card.department.toLowerCase().includes(dep)) ||
                (card.position && card.position.toLowerCase().includes(dep));
                
            const matchEmail = !email || (card.email && card.email.toLowerCase().includes(email));
            const matchAddress = !address || (card.address && card.address.toLowerCase().includes(address));

            return matchKeyword && matchDep && matchEmail && matchAddress;
        });

        renderCards(filtered);
    }

    // 検索イベントのバインド
    if (searchButton) searchButton.addEventListener('click', performSearch);
    
    // Enterキーでも検索発火
    const inputs = [searchKeyword, searchDepartment, searchEmail, searchAddress];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('keydown', (e) => { 
                if(e.key === 'Enter') performSearch(); 
            });
        }
    });
});
