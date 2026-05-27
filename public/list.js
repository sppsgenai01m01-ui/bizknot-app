document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const pcTableBody = document.getElementById('pc-table-body');
    const mobileCardList = document.getElementById('mobile-card-list');
    const searchButton = document.getElementById('search-button');
    const searchKeyword = document.getElementById('search-keyword');
    const exportCsvBtn = document.getElementById('export-csv-button');
    const exportCsvBtnMobile = document.getElementById('export-csv-button-mobile');
    const scrollSentinel = document.getElementById('scroll-sentinel');
    const loadingMoreSpinner = document.getElementById('loading-more-spinner');

    let allCards = []; // インメモリフィルタリング用の全データ保持
    let currentFilteredCards = []; // 現在の検索条件に合致するデータ
    let displayedCount = 0; // 現在画面に表示されている件数
    const CARDS_PER_PAGE = 20; // 1回のスクロールで読み込む件数
    let observer; // IntersectionObserver



    // 認証監視
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            const userNameDisplay = document.getElementById('user-name-display');
            const formattedName = window.formatUserName ? window.formatUserName(user.displayName) : user.displayName;
            if (userNameDisplay) userNameDisplay.textContent = formattedName || user.email;
            fetchAllCards();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Firestoreから全データを取得
    async function fetchAllCards() {
        if (!pcTableBody && !mobileCardList) return;
        
        const loadingHtml = `
            <div class="col-span-full text-center py-12">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                <p class="text-gray-500 mt-4 font-semibold">名刺データを読み込み中...</p>
            </div>
        `;
        if (pcTableBody) pcTableBody.innerHTML = `<tr><td colspan="6">${loadingHtml}</td></tr>`;
        if (mobileCardList) mobileCardList.innerHTML = loadingHtml;

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
            if (pcTableBody) pcTableBody.innerHTML = '';
            if (mobileCardList) mobileCardList.innerHTML = '';
            
            loadMoreCards();
            setupIntersectionObserver();
            
        } catch (error) {
            console.error("Error fetching cards:", error);
            const errHtml = '<p class="col-span-full text-center text-red-500 font-bold py-8">データの読み込みに失敗しました。</p>';
            if (pcTableBody) pcTableBody.innerHTML = `<tr><td colspan="6">${errHtml}</td></tr>`;
            if (mobileCardList) mobileCardList.innerHTML = errHtml;
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

    // 追加のカードを読み込んで描画する
    function loadMoreCards() {
        if (!pcTableBody && !mobileCardList) return;
        
        if (displayedCount >= currentFilteredCards.length) {
            if (loadingMoreSpinner) loadingMoreSpinner.classList.add('hidden');
            return;
        }

        if (loadingMoreSpinner) loadingMoreSpinner.classList.remove('hidden');

        const nextBatch = currentFilteredCards.slice(displayedCount, displayedCount + CARDS_PER_PAGE);
        
        if (displayedCount === 0 && nextBatch.length === 0) {
            const emptyHtml = `
                <div class="col-span-full text-center bg-white rounded-xl shadow-sm border border-gray-200 py-12">
                    <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 font-semibold">条件に一致する名刺が見つかりません</p>
                </div>
            `;
            if (pcTableBody) pcTableBody.innerHTML = `<tr><td colspan="6">${emptyHtml}</td></tr>`;
            if (mobileCardList) mobileCardList.innerHTML = emptyHtml;
            if (loadingMoreSpinner) loadingMoreSpinner.classList.add('hidden');
            return;
        }

        const escapeHTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        nextBatch.forEach(card => {
            const imgSrc = card.imageUrl ? card.imageUrl : "https://placehold.jp/100x100.png?text=No+Image";
            const detailUrl = `/business_card_detail.html?id=${card.id}`;
            const registrantName = card.registeredByName || card.registeredBy || '不明';
            const registrantAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(registrantName)}&background=random`;

            // PC用行描画
            if (pcTableBody) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition cursor-pointer border-b border-slate-100 group";
                tr.onclick = () => window.location.href = detailUrl;
                tr.innerHTML = `
                    <td class="p-4">
                        <div class="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                            <img src="${escapeHTML(imgSrc)}" alt="名刺" class="w-full h-full object-cover">
                        </div>
                    </td>
                    <td class="p-4">
                        <p class="font-bold text-slate-800">${escapeHTML(card.name || '氏名未設定')}</p>
                    </td>
                    <td class="p-4">
                        <p class="text-sm font-bold text-blue-600">${escapeHTML(card.companyName || '会社名未設定')}</p>
                        <p class="text-xs text-slate-500">${escapeHTML([card.department, card.position].filter(Boolean).join(' ') || '部署未設定')}</p>
                    </td>
                    <td class="p-4">
                        <p class="text-xs text-slate-600 mb-1"><i class="fas fa-envelope mr-1 text-slate-400"></i>${escapeHTML(card.email || '-')}</p>
                        <p class="text-xs text-slate-600"><i class="fas fa-phone mr-1 text-slate-400"></i>${escapeHTML(card.companyPhone || card.mobilePhone || '-')}</p>
                    </td>
                    <td class="p-4">
                        <div class="flex items-center gap-2" title="${escapeHTML(registrantName)}が登録しました">
                            <img src="${registrantAvatar}" class="w-6 h-6 rounded-full shadow-sm">
                            <span class="text-xs font-semibold text-slate-700 truncate w-16">${escapeHTML(registrantName)}</span>
                        </div>
                    </td>
                    <td class="p-4">
                        <a href="${detailUrl}" class="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition">
                            詳細を見る<i class="fas fa-chevron-right ml-1"></i>
                        </a>
                    </td>
                `;
                pcTableBody.appendChild(tr);
            }

            // スマホ用カード描画
            if (mobileCardList) {
                const el = document.createElement('a');
                el.href = detailUrl;
                el.className = "block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative pb-10";
                el.innerHTML = `
                    <div class="h-24 bg-slate-100 overflow-hidden border-b border-slate-100">
                        <img src="${escapeHTML(imgSrc)}" alt="名刺画像" class="w-full h-full object-cover opacity-80">
                    </div>
                    <div class="p-4">
                        <p class="text-xs text-blue-600 font-bold mb-1 truncate">${escapeHTML(card.companyName || '会社名未登録')}</p>
                        <h3 class="font-bold text-lg text-slate-800 truncate leading-tight">${escapeHTML(card.name || '氏名未登録')}</h3>
                        <p class="text-[10px] text-slate-500 truncate mt-1">${escapeHTML([card.department, card.position].filter(Boolean).join(' ') || '部署未登録')}</p>
                    </div>
                    <div class="absolute bottom-0 left-0 w-full bg-slate-50 border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                        <span class="text-[10px] text-slate-500 font-medium">登録者:</span>
                        <div class="flex items-center gap-1.5">
                            <img src="${registrantAvatar}" class="w-4 h-4 rounded-full">
                            <span class="text-[10px] font-bold text-slate-700">${escapeHTML(registrantName)}</span>
                        </div>
                    </div>
                `;
                mobileCardList.appendChild(el);
            }
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

        const keyword = searchKeyword ? searchKeyword.value.toLowerCase() : '';

        currentFilteredCards = allCards.filter(card => {
            const matchKeyword = !keyword || 
                (card.name && card.name.toLowerCase().includes(keyword)) ||
                (card.companyName && card.companyName.toLowerCase().includes(keyword)) ||
                (card.department && card.department.toLowerCase().includes(keyword));
            
            return matchKeyword;
        });

        if (pcTableBody) pcTableBody.innerHTML = '';
        if (mobileCardList) mobileCardList.innerHTML = '';
        displayedCount = 0;
        loadMoreCards();
    }

    // CSVエクスポート実行（単体テスト済みのモジュールを呼び出す）
    async function exportCsv() {
        // 画面の見た目だけでなく、フィルタ条件に合致する「全件（未ロード分含む）」を出力
        const targetData = currentFilteredCards && currentFilteredCards.length > 0 ? currentFilteredCards : allCards;

        if (!targetData || targetData.length === 0) {
            alert("エクスポートするデータがありません。");
            return;
        }

        try {
            // テスト済みの共通ロジックを動的インポート
            const { generateCsvString } = await import('./utils/csvExporter.js');
            
            // csvExporter.js が期待するフォーマット（氏名, 会社, 部署, 電話, メール, 登録日）にデータを変換
            const mappedData = targetData.map(card => {
                let createdAtStr = "";
                if (card.createdAt && card.createdAt.toMillis) {
                    createdAtStr = new Date(card.createdAt.toMillis()).toISOString();
                } else if (card.createdAt) {
                    createdAtStr = card.createdAt;
                }

                return {
                    name: card.name,
                    company: card.companyName,
                    department: [card.department, card.position].filter(Boolean).join(' '),
                    phone: card.companyPhone || card.mobilePhone || card.fax,
                    email: card.email,
                    createdAt: createdAtStr
                };
            });

            // 文字列変換 (サニタイズ処理、BOM付与、ヘッダー固定化が自動で行われる)
            const csvContent = generateCsvString(mappedData);
            
            // ダウンロード処理
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            a.download = `bizknot_cards_${dateStr}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error("CSVエクスポートに失敗しました:", error);
            alert("CSVの生成中にエラーが発生しました。");
        }
    }

    // イベントバインド
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);
    if (exportCsvBtnMobile) exportCsvBtnMobile.addEventListener('click', exportCsv);

    if (searchButton) searchButton.addEventListener('click', performSearch);
    
    if (searchKeyword) {
        searchKeyword.addEventListener('keydown', (e) => { 
            if(e.key === 'Enter') performSearch(); 
        });
    }
});