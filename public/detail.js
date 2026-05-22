document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM要素
    const container = document.getElementById('detail-container');
    const cardImage = document.getElementById('card-image');
    const personName = document.getElementById('person-name');
    const companyName = document.getElementById('company-name');
    const departmentTitle = document.getElementById('department-title');
    const emailField = document.getElementById('email-field');
    const companyPhoneField = document.getElementById('company-phone-field');
    const mobilePhoneField = document.getElementById('mobile-phone-field');
    const faxField = document.getElementById('fax-field');
    const addressField = document.getElementById('address-field');
    const customFieldsDisplayContainer = document.getElementById('custom-fields-display');
    const customFieldsListDisplay = document.getElementById('custom-fields-list-display');
    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');
    const historyButton = document.getElementById('history-button'); // 追加

    // 履歴ボタンの表示
    if (historyButton) {
        historyButton.style.display = 'inline-block';
        historyButton.addEventListener('click', showHistoryModal);
    }

    let currentUser = null;
    let userPermission = 'user';
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');

    if (!cardId) {
        alert('名刺IDが指定されていません。');
        window.location.href = '/business_card_list.html';
        return;
    }

    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            // ユーザー権限の取得
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    userPermission = userDoc.data().permission || 'user';
                }
            } catch (e) {
                console.error("ユーザー情報の取得に失敗しました", e);
            }
            fetchCardDetails();
        } else {
            window.location.href = '/';
        }
    });

    async function fetchCardDetails() {
        try {
            const doc = await db.collection('businessCards').doc(cardId).get();

            if (doc.exists) {
                const data = doc.data();

                // 論理削除チェック
                if (data.deletedAt) {
                    alert('この名刺データは削除されています。');
                    window.location.href = '/business_card_list.html';
                    return;
                }

                // プレビュー画像
                if (cardImage) {
                    if (data.imageUrl) {
                        cardImage.src = data.imageUrl;
                        cardImage.classList.add('cursor-pointer');
                    } else {
                        cardImage.src = "https://placehold.jp/300x200.png?text=No+Image";
                        cardImage.classList.remove('cursor-pointer');
                    }

                    // ライトボックス機能のセットアップ
                    const lightboxModal = document.getElementById('lightbox-modal');
                    const lightboxImage = document.getElementById('lightbox-image');
                    const closeLightboxBtn = document.getElementById('close-lightbox-btn');
                    
                    if (lightboxModal && lightboxImage && data.imageUrl) {
                        // クリックで拡大表示
                        cardImage.addEventListener('click', () => {
                            lightboxImage.src = data.imageUrl;
                            lightboxModal.classList.remove('hidden');
                        });
                        
                        // 閉じる処理
                        const closeLightbox = () => {
                            lightboxModal.classList.add('hidden');
                            lightboxImage.src = ''; // メモリ解放
                        };
                        if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);
                        lightboxModal.addEventListener('click', (e) => {
                            if (e.target === lightboxModal) closeLightbox();
                        });
                    }
                }

                // 基本情報
                if (personName) personName.textContent = data.name || "氏名未登録";
                if (companyName) companyName.textContent = data.companyName || "会社名未登録";
                
                let depTitle = [];
                if (data.department) depTitle.push(data.department);
                if (data.position) depTitle.push(data.position);
                if (departmentTitle) departmentTitle.textContent = depTitle.join(" ") || "部署・役職未登録";

                // 連絡先
                const createEmailButton = (email) => {
                    if (!email) return `<span class="font-bold text-gray-600 w-24 inline-block">Email:</span> 未登録`;
                    return `<div class="flex flex-wrap items-center gap-2"><span class="font-bold text-gray-600 w-24 flex-shrink-0">Email:</span>
                            <span class="text-gray-800 break-all">${email}</span>
                            <a href="mailto:${email}" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm inline-flex items-center shadow-sm transition-colors md:ml-auto">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                メール送信
                            </a></div>`;
                };
                
                const createPhoneButton = (label, phone) => {
                    if (!phone) return `<span class="font-bold text-gray-600 w-24 inline-block">${label}:</span> 未登録`;
                    const cleanPhone = phone.replace(/[^\d+]/g, '');
                    return `<div class="flex flex-wrap items-center gap-2"><span class="font-bold text-gray-600 w-24 flex-shrink-0">${label}:</span> 
                            <span class="text-gray-800">${phone}</span>
                            <a href="tel:${cleanPhone}" class="md:hidden bg-green-500 active:bg-green-600 text-white px-3 py-1.5 rounded-full text-sm inline-flex items-center shadow-sm transition-colors ml-auto">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                電話をかける
                            </a></div>`;
                };

                if (emailField) emailField.innerHTML = createEmailButton(data.email);
                if (companyPhoneField) companyPhoneField.innerHTML = createPhoneButton("会社TEL", data.companyPhone);
                if (mobilePhoneField) mobilePhoneField.innerHTML = createPhoneButton("携帯TEL", data.mobilePhone);
                if (faxField) faxField.innerHTML = `<span class="font-bold text-gray-600 w-24 inline-block">FAX:</span> ${data.fax || "未登録"}`;
                if (addressField) addressField.innerHTML = `<span class="font-bold text-gray-600 w-24 inline-block">Address:</span> ${data.address || "未登録"}`;

                // メモ（OCR全文など）の表示
                if (customFieldsDisplayContainer && customFieldsListDisplay) {
                    if (data.memo) {
                        customFieldsListDisplay.innerHTML = `<div class="text-sm"><dt class="font-semibold text-gray-600 border-b pb-2 mb-2">メモ・OCR読み取り結果</dt><dd class="text-gray-800 p-3 bg-gray-50 rounded border whitespace-pre-wrap leading-relaxed">${data.memo}</dd></div>`;
                        customFieldsDisplayContainer.style.display = 'block';
                    } else {
                        customFieldsDisplayContainer.style.display = 'none';
                    }
                }

                // ▼▼ お客様の新機能：カスタム項目の表示処理を呼び出し ▼▼
                if (data.customData) {
                    await renderCustomFields(data.customData);
                }

                // 権限による削除ボタンの表示制御
                // オーナー自身、または管理者の場合のみ削除可能
                if (deleteButton) {
                    if (data.ownerId === currentUser.uid || userPermission === 'admin') {
                        deleteButton.style.display = 'inline-block';
                    } else {
                        deleteButton.style.display = 'none';
                    }
                }

            } else {
                alert('名刺データが見つかりません。');
            }
        } catch (error) {
            console.error("Error fetching document:", error);
            alert('データの読み込みに失敗しました。');
        } finally {
            // エラー時でも必ずローディング（真っ白画面）を解除する
            if (container) container.classList.remove('opacity-0');
            const loadingSkeleton = document.getElementById('loading-skeleton');
            if (loadingSkeleton) loadingSkeleton.classList.add('hidden');
        }
    }

    // ★★★ お客様の新機能：カスタム項目を描画する新関数 ★★★
    async function renderCustomFields(customData) {
        if (!customFieldsDisplayContainer || !customFieldsListDisplay) return;

        if (!customData || Object.keys(customData).length === 0) {
            // メモがなければ非表示にするが、メモがあればそのまま表示を維持
            return;
        }

        const fieldDefs = await getCustomFieldDefinitions();
        let contentAdded = false;

        for (const key in customData) {
            const value = customData[key];
            if (value && fieldDefs.has(key)) {
                const label = fieldDefs.get(key);
                const fieldEl = document.createElement('div');
                fieldEl.classList.add('text-sm');
                fieldEl.innerHTML = `
                    <dt class="font-semibold text-gray-600">${label}:</dt>
                    <dd class="text-gray-800 pl-2">${value}</dd>
                `;
                customFieldsListDisplay.appendChild(fieldEl);
                contentAdded = true;
            }
        }

        if (contentAdded) {
            customFieldsDisplayContainer.style.display = 'block';
        }
    }

    async function getCustomFieldDefinitions() {
        const definitions = new Map();
        try {
            const snapshot = await db.collection('customFields').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                definitions.set(data.key, data.label);
            });
        } catch (error) {
            console.error("Error getting custom field definitions: ", error);
        }
        return definitions;
    }

    if (editButton) {
        editButton.addEventListener('click', () => {
            window.location.href = `/business_card_form.html?id=${cardId}`;
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
            if (confirm('本当にこの名刺データを削除しますか？\n（ゴミ箱へ移動します）')) {
                try {
                    await db.collection('businessCards').doc(cardId).update({
                        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert('削除しました。');
                    window.location.href = '/business_card_list.html';
                } catch (error) {
                    console.error("Error deleting document:", error);
                    alert('削除に失敗しました。');
                }
            }
        });
    }

    // --- 履歴表示機能 ---
    async function showHistoryModal() {
        if (!cardId) return;

        // モーダルの作成
        let modal = document.getElementById('history-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'history-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4">
                    <div class="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                        <h3 class="text-xl font-bold text-gray-800">更新履歴</h3>
                        <button id="close-history-modal" class="text-gray-500 hover:text-red-500 bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-4 overflow-y-auto flex-1 bg-gray-100" id="history-content">
                        <div class="flex justify-center my-8"><div class="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-500"></div></div>
                    </div>
                    <div class="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                        <button id="close-history-modal-btn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded shadow">閉じる</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const closeModal = () => modal.classList.add('hidden');
            document.getElementById('close-history-modal').addEventListener('click', closeModal);
            document.getElementById('close-history-modal-btn').addEventListener('click', closeModal);
        }
        modal.classList.remove('hidden');

        const historyContent = document.getElementById('history-content');
        historyContent.innerHTML = '<div class="flex justify-center my-8"><div class="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-500"></div></div>';

        try {
            const snapshot = await db.collection('businessCards').doc(cardId).collection('history').orderBy('archivedAt', 'desc').get();
            if (snapshot.empty) {
                historyContent.innerHTML = '<p class="text-center text-gray-500 py-8">更新履歴はありません。</p>';
                return;
            }

            let html = '<div class="space-y-4">';
            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.archivedAt ? data.archivedAt.toDate().toLocaleString('ja-JP') : '不明な日時';
                html += `
                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200">
                        <div class="text-sm text-gray-500 mb-2 border-b pb-1">変更前データ (保存日時: ${date})</div>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div><span class="text-gray-500">会社名:</span> <span class="font-medium">${data.companyName || '-'}</span></div>
                            <div><span class="text-gray-500">氏名:</span> <span class="font-medium">${data.name || '-'}</span></div>
                            <div><span class="text-gray-500">部署:</span> ${data.department || '-'}</div>
                            <div><span class="text-gray-500">役職:</span> ${data.position || '-'}</div>
                            <div class="col-span-2"><span class="text-gray-500">Email:</span> ${data.email || '-'}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            historyContent.innerHTML = html;

        } catch (error) {
            console.error("履歴の取得に失敗:", error);
            historyContent.innerHTML = '<p class="text-center text-red-500 py-8">履歴の取得に失敗しました。</p>';
        }
    }
});
