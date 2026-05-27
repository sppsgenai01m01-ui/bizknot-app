document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM要素
    const container = document.getElementById('detail-container');
    const loadingSkeleton = document.getElementById('loading-skeleton');
    const errorMessage = document.getElementById('error-message');
    
    const cardImage = document.getElementById('card-image');
    const personName = document.getElementById('person-name');
    const companyName = document.getElementById('company-name');
    const departmentTitle = document.getElementById('department-title');
    const emailField = document.getElementById('email-field');
    const companyPhoneField = document.getElementById('company-phone-field');
    const mobilePhoneField = document.getElementById('mobile-phone-field');
    const faxField = document.getElementById('fax-field');
    const addressField = document.getElementById('address-field');
    
    // カスタム項目とメモ
    const customFieldsDisplayContainer = document.getElementById('custom-fields-display');
    const customFieldsListDisplay = document.getElementById('custom-fields-list-display');
    const notesText = document.getElementById('notes-text');
    
    // アプローチ情報（最終連絡）
    const lastContactDateEl = document.getElementById('last-contact-date');
    const lastContactTriggerEl = document.getElementById('last-contact-trigger');
    const testUpdateContactBtn = document.getElementById('test-update-contact-btn');

    // AIコンテキストパネル
    const aiTagsContainer = document.getElementById('ai-tags-container');
    const projectHistoryContainer = document.getElementById('project-history-container');
    const aiDraftBtn = document.getElementById('ai-draft-btn');
    const editTagsHistoryBtn = document.getElementById('edit-tags-history-btn');

    // モーダル関連（AIプロンプト）
    const aiPromptModal = document.getElementById('ai-prompt-modal');
    const aiPromptSelect = document.getElementById('ai-prompt-select');
    const aiPromptTextarea = document.getElementById('ai-prompt-textarea');
    const submitAiPromptBtn = document.getElementById('submit-ai-prompt-btn');
    const cancelAiPromptBtn = document.getElementById('cancel-ai-prompt-btn');

    // モーダル関連（タグ・履歴編集）
    const editContextModal = document.getElementById('edit-context-modal');
    const editTagsInput = document.getElementById('edit-tags-input');
    const editHistoryInput = document.getElementById('edit-history-input');
    const saveContextBtn = document.getElementById('save-context-btn');
    const cancelContextBtn = document.getElementById('cancel-context-btn');

    // 基本アクションボタン
    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');

    let currentUser = null;
    let userPermission = 'user';
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');
    let currentCardData = null;
    let customFieldDefs = [];
    let aiPromptTemplates = [];

    if (!cardId) {
        alert('名刺IDが指定されていません。');
        window.location.href = '/business_card_list.html';
        return;
    }

    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    userPermission = userDoc.data().permission || 'user';
                }
            } catch (e) {
                console.error("ユーザー情報の取得に失敗", e);
            }
            
            await fetchCustomFieldDefinitions();
            await fetchAiPrompts();
            fetchCardDetails();
        } else {
            window.location.href = '/';
        }
    });

    async function fetchCustomFieldDefinitions() {
        try {
            const snapshot = await db.collection('fieldDefinitions').get();
            customFieldDefs = [];
            snapshot.forEach(doc => customFieldDefs.push({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching custom fields:", error);
        }
    }

    async function fetchAiPrompts() {
        try {
            const snapshot = await db.collection('aiprompts').get();
            aiPromptTemplates = [];
            snapshot.forEach(doc => aiPromptTemplates.push({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching AI prompts:", error);
        }
    }

    async function fetchCardDetails() {
        try {
            const doc = await db.collection('businessCards').doc(cardId).get();

            if (doc.exists) {
                currentCardData = doc.data();

                if (currentCardData.deletedAt) {
                    alert('この名刺データは削除されています。');
                    window.location.href = '/business_card_list.html';
                    return;
                }

                renderUI();
                
                loadingSkeleton.classList.add('hidden');
                container.classList.remove('opacity-0');
            } else {
                loadingSkeleton.classList.add('hidden');
                errorMessage.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error getting document:", error);
            loadingSkeleton.classList.add('hidden');
            errorMessage.classList.remove('hidden');
            errorMessage.innerHTML = '<p>データの取得中にエラーが発生しました。</p>';
        }
    }

    const escapeHTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function renderUI() {
        const data = currentCardData;

        // 画像
        if (cardImage) {
            if (data.imageUrl) {
                cardImage.src = data.imageUrl;
                cardImage.classList.add('cursor-pointer');
            } else {
                cardImage.src = "https://placehold.jp/300x200.png?text=No+Image";
                cardImage.classList.remove('cursor-pointer');
            }
            
            const lightboxModal = document.getElementById('lightbox-modal');
            const lightboxImage = document.getElementById('lightbox-image');
            const closeLightboxBtn = document.getElementById('close-lightbox-btn');
            
            if (lightboxModal && lightboxImage && data.imageUrl) {
                cardImage.onclick = () => {
                    lightboxImage.src = data.imageUrl;
                    lightboxModal.classList.remove('hidden');
                };
                const closeLightbox = () => {
                    lightboxModal.classList.add('hidden');
                    lightboxImage.src = '';
                };
                if (closeLightboxBtn) closeLightboxBtn.onclick = closeLightbox;
                lightboxModal.onclick = (e) => { if (e.target === lightboxModal) closeLightbox(); };
            }
        }

        // 基本情報
        if (personName) personName.textContent = data.name || "氏名未登録";
        if (companyName) companyName.textContent = data.companyName || "会社名未登録";
        
        let depTitle = [];
        if (data.department) depTitle.push(data.department);
        if (data.position) depTitle.push(data.position);
        if (departmentTitle) departmentTitle.textContent = depTitle.join(" ") || "部署・役職未登録";

        // アプローチ情報（最終連絡）
        if (lastContactDateEl) lastContactDateEl.textContent = data.lastContactDate || '未連絡';
        if (lastContactTriggerEl) lastContactTriggerEl.textContent = data.lastContactTrigger || '-';

        // 連絡先
        const createEmailButton = (email) => {
            if (!email) return `<span class="font-bold text-gray-600 w-24 inline-block">Email:</span> 未登録`;
            return `<div class="flex flex-wrap items-center gap-2"><span class="font-bold text-gray-600 w-24 flex-shrink-0">Email:</span>
                    <span class="text-gray-800 break-all">${escapeHTML(email)}</span>
                    <a href="mailto:${escapeHTML(email)}" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm inline-flex items-center shadow-sm transition-colors md:ml-auto">
                        メール送信
                    </a></div>`;
        };
        const createPhoneButton = (label, phone) => {
            if (!phone) return `<span class="font-bold text-gray-600 w-24 inline-block">${label}:</span> 未登録`;
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            return `<div class="flex flex-wrap items-center gap-2"><span class="font-bold text-gray-600 w-24 flex-shrink-0">${label}:</span> 
                    <span class="text-gray-800">${escapeHTML(phone)}</span>
                    <a href="tel:${cleanPhone}" class="md:hidden bg-green-500 active:bg-green-600 text-white px-3 py-1.5 rounded-full text-sm inline-flex items-center shadow-sm transition-colors ml-auto">
                        電話をかける
                    </a></div>`;
        };

        if (emailField) emailField.innerHTML = createEmailButton(data.email);
        if (companyPhoneField) companyPhoneField.innerHTML = createPhoneButton("会社TEL", data.companyPhone);
        if (mobilePhoneField) mobilePhoneField.innerHTML = createPhoneButton("携帯TEL", data.mobilePhone);
        if (faxField) faxField.innerHTML = `<span class="font-bold text-gray-600 w-24 inline-block">FAX:</span> ${escapeHTML(data.fax || "未登録")}`;
        if (addressField) addressField.innerHTML = `<span class="font-bold text-gray-600 w-24 inline-block">Address:</span> ${escapeHTML(data.address || "未登録")}`;

        // カスタム項目 & メモの表示
        let hasCustomData = false;
        if (customFieldsListDisplay) {
            customFieldsListDisplay.innerHTML = '';
            if (customFieldDefs.length > 0) {
                customFieldDefs.forEach(field => {
                    const val = (data.customData && data.customData[field.key]) ? data.customData[field.key] : '未設定';
                    customFieldsListDisplay.innerHTML += `
                        <div class="flex border-b border-gray-100 pb-2">
                            <span class="font-semibold text-gray-600 w-32 flex-shrink-0">${escapeHTML(field.label)}:</span>
                            <span class="text-gray-800">${escapeHTML(val)}</span>
                        </div>
                    `;
                });
                hasCustomData = true;
            }
        }
        
        if (notesText) {
            if (data.notes && data.notes.trim()) {
                notesText.textContent = data.notes;
                hasCustomData = true;
            } else {
                notesText.textContent = "メモはありません。";
            }
        }

        if (customFieldsDisplayContainer && hasCustomData) {
            customFieldsDisplayContainer.style.display = 'block';
        }

        // AIマッピング情報の表示
        if (aiTagsContainer) {
            aiTagsContainer.innerHTML = '';
            let tags = [];
            if (Array.isArray(data.tags)) tags = data.tags;
            else if (typeof data.tags === 'string') tags = data.tags.split(',').map(s=>s.trim()).filter(Boolean);
            
            if (tags.length > 0) {
                tags.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = "px-2 py-1 bg-white text-blue-700 rounded text-xs border border-blue-200 font-medium";
                    span.textContent = `#${escapeHTML(tag)}`;
                    aiTagsContainer.appendChild(span);
                });
            } else {
                aiTagsContainer.innerHTML = '<span class="text-xs text-gray-400">タグ未設定</span>';
            }
        }

        if (projectHistoryContainer) {
            projectHistoryContainer.innerHTML = '';
            const history = data.projectHistory || '';
            if (history.trim()) {
                const lines = history.split('\n');
                lines.forEach(line => {
                    if(!line.trim()) return;
                    projectHistoryContainer.innerHTML += `
                        <li class="flex items-start gap-2">
                            <div class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5"></div>
                            <div>${escapeHTML(line)}</div>
                        </li>
                    `;
                });
            } else {
                projectHistoryContainer.innerHTML = `
                    <li class="flex items-start gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5"></div>
                        <div class="text-gray-400">特筆すべき過去の取引履歴はまだありません。</div>
                    </li>
                `;
            }
        }

        // 権限によるボタン制御
        const isOwner = currentUser && (data.ownerId === currentUser.uid || data.registeredByUid === currentUser.uid);
        const isAdmin = userPermission === 'admin';
        if (isAdmin || isOwner) {
            if (deleteButton) deleteButton.style.display = 'inline-block';
        }
    }

    // 更新テストボタン
    if (testUpdateContactBtn) {
        testUpdateContactBtn.addEventListener('click', async () => {
            try {
                const now = new Date();
                const dateStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                await db.collection('businessCards').doc(cardId).update({
                    lastContactDate: dateStr,
                    lastContactTrigger: '手動更新 (テスト)'
                });
                alert('最終連絡日時を更新しました。');
                fetchCardDetails();
            } catch(e) {
                console.error(e);
                alert('更新に失敗しました');
            }
        });
    }

    // タグ・履歴編集のモーダル制御
    if (editTagsHistoryBtn) {
        editTagsHistoryBtn.addEventListener('click', () => {
            if(!currentCardData) return;
            let tags = '';
            if (Array.isArray(currentCardData.tags)) tags = currentCardData.tags.join(', ');
            else if (typeof currentCardData.tags === 'string') tags = currentCardData.tags;
            
            editTagsInput.value = tags;
            editHistoryInput.value = currentCardData.projectHistory || '';
            editContextModal.classList.remove('hidden');
        });
    }
    if (cancelContextBtn) {
        cancelContextBtn.addEventListener('click', () => {
            editContextModal.classList.add('hidden');
        });
    }
    if (saveContextBtn) {
        saveContextBtn.addEventListener('click', async () => {
            try {
                const tagsArr = editTagsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
                await db.collection('businessCards').doc(cardId).update({
                    tags: tagsArr,
                    projectHistory: editHistoryInput.value.trim()
                });
                editContextModal.classList.add('hidden');
                fetchCardDetails();
            } catch(e) {
                console.error(e);
                alert('保存に失敗しました');
            }
        });
    }

    // AIプロンプトダイアログの制御
    if (aiDraftBtn) {
        aiDraftBtn.addEventListener('click', () => {
            // セレクトボックスの初期化
            aiPromptSelect.innerHTML = '<option value="">（選択してください）</option>';
            aiPromptTemplates.forEach(template => {
                const opt = document.createElement('option');
                opt.value = template.text;
                opt.textContent = template.title;
                aiPromptSelect.appendChild(opt);
            });
            aiPromptTextarea.value = '';
            aiPromptModal.classList.remove('hidden');
        });
    }
    if (aiPromptSelect) {
        aiPromptSelect.addEventListener('change', (e) => {
            aiPromptTextarea.value = e.target.value;
        });
    }
    if (cancelAiPromptBtn) {
        cancelAiPromptBtn.addEventListener('click', () => {
            aiPromptModal.classList.add('hidden');
        });
    }
    if (submitAiPromptBtn) {
        submitAiPromptBtn.addEventListener('click', async () => {
            const promptText = aiPromptTextarea.value.trim();
            if (!promptText) {
                alert('プロンプト内容を入力または選択してください。');
                return;
            }
            try {
                submitAiPromptBtn.innerHTML = '処理中...';
                submitAiPromptBtn.disabled = true;
                
                const now = new Date();
                const dateStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                
                await db.collection('businessCards').doc(cardId).update({
                    lastContactDate: dateStr,
                    lastContactTrigger: 'AIアプローチ作成'
                });
                
                alert('AIへ指示を送信し、アプローチ文面を作成しました！（MVPデモ）\\n最終連絡日時が更新されました。');
                
                aiPromptModal.classList.add('hidden');
                fetchCardDetails();
            } catch (e) {
                console.error(e);
                alert('エラーが発生しました。');
            } finally {
                submitAiPromptBtn.innerHTML = '作成開始';
                submitAiPromptBtn.disabled = false;
            }
        });
    }

    if (editButton) {
        editButton.addEventListener('click', () => {
            window.location.href = `/business_card_form.html?id=${cardId}`;
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
            if (confirm('本当にこの名刺データを削除しますか？\n（論理削除され、一覧から表示されなくなります）')) {
                try {
                    await db.collection('businessCards').doc(cardId).update({
                        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // auditLog
                    try {
                        await db.collection('auditLogs').add({
                            collectionName: 'businessCards',
                            documentId: cardId,
                            action: 'LOGICAL_DELETE',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            performedByUid: currentUser ? currentUser.uid : 'unknown',
                            performedByName: currentUser ? currentUser.displayName : 'unknown'
                        });
                    } catch(logErr) {
                        console.error('Audit log failed', logErr);
                    }
                    
                    alert('削除しました。');
                    window.location.href = '/business_card_list.html';
                } catch (error) {
                    console.error("Error deleting document:", error);
                    alert('削除中にエラーが発生しました。');
                }
            }
        });
    }
});