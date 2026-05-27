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
    const toggleAdvancedSearchBtn = document.getElementById('toggle-advanced-search');
    const advancedSearchPanel = document.getElementById('advanced-search-panel');
    const advancedSearchIcon = document.getElementById('advanced-search-icon');
    const customFieldsSearchContainer = document.getElementById('custom-fields-search-container');

    let allCards = []; 
    let currentFilteredCards = [];
    let displayedCount = 0;
    const CARDS_PER_PAGE = 20;
    let observer;
    let customFieldDefinitions = [];

    // 認証監視
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            await fetchCustomFieldDefinitions();
            fetchAllCards();
        } else {
            window.location.href = 'index.html';
        }
    });

    // 詳細検索パネルのトグル
    if (toggleAdvancedSearchBtn) {
        toggleAdvancedSearchBtn.addEventListener('click', () => {
            advancedSearchPanel.classList.toggle('hidden');
            advancedSearchIcon.classList.toggle('rotate-180');
        });
    }

    // カスタム項目定義の取得と検索UIの生成
    async function fetchCustomFieldDefinitions() {
        try {
            const snapshot = await db.collection('fieldDefinitions').get();
            customFieldDefinitions = [];
            snapshot.forEach(doc => {
                customFieldDefinitions.push({ id: doc.id, ...doc.data() });
            });
            renderAdvancedSearchUI();
        } catch (error) {
            console.error("Error fetching custom fields:", error);
        }
    }

    function renderAdvancedSearchUI() {
        if (!customFieldsSearchContainer) return;
        customFieldsSearchContainer.innerHTML = '';
        
        customFieldDefinitions.forEach(field => {
            const div = document.createElement('div');
            div.innerHTML = `
                <label class="block text-xs font-semibold text-slate-500 mb-1">${escapeHTML(field.label)}</label>
                <input type="text" id="search-custom-${field.key}" data-key="${field.key}" class="custom-search-input w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
            `;
            customFieldsSearchContainer.appendChild(div);
        });
    }

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

            performSearch();
            
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

    const escapeHTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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

        nextBatch.forEach(card => {
            const imgSrc = card.imageUrl ? card.imageUrl : "https://placehold.jp/100x100.png?text=No+Image";
            const detailUrl = `/business_card_detail.html?id=${card.id}`;
            const lastContactDateStr = card.lastContactDate ? card.lastContactDate : '-';
            const lastContactTriggerStr = card.lastContactTrigger ? card.lastContactTrigger : '-';

            // PC用行描画
            if (pcTableBody) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50 transition cursor-pointer border-b border-slate-100 group";
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
                        <p class="text-sm text-slate-700 font-medium">${escapeHTML(lastContactDateStr)}</p>
                    </td>
                    <td class="p-4">
                        <span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">${escapeHTML(lastContactTriggerStr)}</span>
                    </td>
                `;
                pcTableBody.appendChild(tr);
            }

            // スマホ用カード描画
            if (mobileCardList) {
                const el = document.createElement('a');
                el.href = detailUrl;
                el.className = "block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative pb-12";
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
                        <span class="text-[10px] text-slate-500 font-medium">最終連絡: ${escapeHTML(lastContactDateStr)}</span>
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
        
        // カスタム項目の検索条件を取得
        const customFilters = {};
        const customInputs = document.querySelectorAll('.custom-search-input');
        customInputs.forEach(input => {
            const val = input.value.trim().toLowerCase();
            if (val) {
                customFilters[input.dataset.key] = val;
            }
        });

        currentFilteredCards = allCards.filter(card => {
            // 1. キーワード検索（OR条件）
            const matchKeyword = !keyword || 
                (card.name && card.name.toLowerCase().includes(keyword)) ||
                (card.companyName && card.companyName.toLowerCase().includes(keyword)) ||
                (card.department && card.department.toLowerCase().includes(keyword));
            
            if (!matchKeyword) return false;

            // 2. カスタム項目検索（AND条件）
            let matchCustom = true;
            for (const key in customFilters) {
                const searchVal = customFilters[key];
                const cardVal = (card.customFields && card.customFields[key]) ? String(card.customFields[key]).toLowerCase() : '';
                if (!cardVal.includes(searchVal)) {
                    matchCustom = false;
                    break;
                }
            }

            return matchCustom;
        });

        displayedCount = 0;
        if (pcTableBody) pcTableBody.innerHTML = '';
        if (mobileCardList) mobileCardList.innerHTML = '';
        
        loadMoreCards();
        setupIntersectionObserver();
    }

    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
    if (searchKeyword) {
        searchKeyword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    // CSVエクスポート
    function exportCsv() {
        if (!currentFilteredCards.length) {
            alert("エクスポートするデータがありません。");
            return;
        }
        
        // ヘッダー作成（基本項目＋カスタム項目）
        let headers = ["ID", "会社名", "氏名", "部署", "役職", "メールアドレス", "電話番号(会社)", "電話番号(携帯)", "登録日時", "最終連絡日時", "連絡のきっかけ"];
        customFieldDefinitions.forEach(f => headers.push(f.label));

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\r\n";
        
        currentFilteredCards.forEach(card => {
            const row = [
                card.id || '',
                card.companyName || '',
                card.name || '',
                card.department || '',
                card.position || '',
                card.email || '',
                card.companyPhone || '',
                card.mobilePhone || '',
                card.createdAt ? new Date(card.createdAt.seconds * 1000).toLocaleString() : '',
                card.lastContactDate || '',
                card.lastContactTrigger || ''
            ].map(val => `"${String(val).replace(/"/g, '""')}"`);

            customFieldDefinitions.forEach(f => {
                const val = (card.customFields && card.customFields[f.key]) ? card.customFields[f.key] : '';
                row.push(`"${String(val).replace(/"/g, '""')}"`);
            });

            csvContent += row.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `bizknot_export_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);
    if (exportCsvBtnMobile) exportCsvBtnMobile.addEventListener('click', exportCsv);
});