document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    const cardForm = document.getElementById('card-form');
    const messageArea = document.getElementById('message-area');
    const submitButton = document.getElementById('submit-button');
    const imagePreview = document.getElementById('image-preview');
    const noImageText = document.getElementById('no-image-text');

    let currentUser = null;
    let cardId = new URLSearchParams(window.location.search).get('id');
    let customFieldsDef = []; // カスタム項目の定義を保持

    let draftData = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadCustomFields().then(() => {
                if (cardId) {
                    // 編集モード：Firestoreからデータを取得
                    loadCardData(cardId);
                } else {
                // 新規登録モード：SessionStorageにOCR結果があれば読み込む
                const draftString = sessionStorage.getItem('ocrDraft');
                if (draftString) {
                    try {
                        draftData = JSON.parse(draftString);
                        populateFormFromDraft(draftData);
                    } catch (e) {
                        console.error("SessionStorageのパースに失敗しました", e);
                    }
                    }
                }
            });
        } else {
            window.location.href = 'index.html';
        }
    });

    // キャンセルボタンの処理
    const cancelButton = document.getElementById('cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            if (confirm('入力内容を破棄して一覧に戻りますか？')) {
                sessionStorage.removeItem('ocrDraft');
                window.location.href = '/dashboard.html';
            }
        });
    }

    // カスタム項目定義の読み込みとフォーム生成
    async function loadCustomFields() {
        try {
            const snapshot = await db.collection('customFields').orderBy('label').get();
            if (!snapshot.empty) {
                const container = document.getElementById('custom-fields-container');
                const wrapper = document.getElementById('custom-fields-wrapper');
                
                // キャッシュ等で古いHTMLが読み込まれており、要素が存在しない場合はスキップ
                if (!wrapper) {
                    console.warn("カスタム項目の表示エリアが見つかりません。");
                    return;
                }
                
                snapshot.forEach(doc => {
                    const field = doc.data();
                    customFieldsDef.push({ id: doc.id, ...field });
                    
                    const div = document.createElement('div');
                    div.className = 'form-group';
                    
                    const requiredHtml = field.isRequired ? '<span class="required">*</span>' : '';
                    const inputRequired = field.isRequired ? 'required' : '';
                    
                    let inputHtml = '';
                    if (field.type === 'textarea') {
                        inputHtml = `<textarea id="custom_${field.key}" name="custom_${field.key}" rows="3" ${inputRequired}></textarea>`;
                    } else if (field.type === 'number') {
                        inputHtml = `<input type="number" id="custom_${field.key}" name="custom_${field.key}" ${inputRequired}>`;
                    } else if (field.type === 'date') {
                        inputHtml = `<input type="date" id="custom_${field.key}" name="custom_${field.key}" ${inputRequired}>`;
                    } else {
                        inputHtml = `<input type="text" id="custom_${field.key}" name="custom_${field.key}" ${inputRequired}>`;
                    }

                    div.innerHTML = `
                        <label for="custom_${field.key}">${field.label}${requiredHtml}</label>
                        ${inputHtml}
                    `;
                    wrapper.appendChild(div);
                });
                
                if (customFieldsDef.length > 0) {
                    container.classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error("カスタム項目の読み込みエラー:", error);
        }
    }

    // OCR推測データをフォームにセットする関数
    function populateFormFromDraft(data) {
        if (data.imageUrl) {
            imagePreview.src = data.imageUrl;
            imagePreview.classList.remove('hidden');
            noImageText.classList.add('hidden');
        }

        const setVal = (id, val) => {
            if (val) {
                const el = document.getElementById(id);
                if (el) el.value = val;
            }
        };

        setVal('company', data.companyName);
        setVal('department', data.department);
        setVal('title', data.position);
        setVal('name', data.name);
        setVal('email', data.email);
        setVal('company_tel', data.companyPhone);
        setVal('mobile_tel', data.mobilePhone);
        setVal('fax', data.fax);
        setVal('address', data.address);
        setVal('notes', data.memo);
    }

    async function loadCardData(id) {
        try {
            const docRef = db.collection('businessCards').doc(id);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                
                // 画像プレビューの表示
                if (data.imageUrl) {
                    imagePreview.src = data.imageUrl;
                    imagePreview.classList.remove('hidden');
                    noImageText.classList.add('hidden');
                }

                // フォームへの自動入力（要素が存在する場合のみセットする安全な実装）
                const setVal = (id, val) => {
                    if (val) {
                        const el = document.getElementById(id);
                        if (el) el.value = val;
                    }
                };

                setVal('company', data.companyName);
                setVal('department', data.department);
                setVal('title', data.position);
                setVal('name', data.name);
                setVal('email', data.email);
                setVal('company_tel', data.companyPhone);
                setVal('mobile_tel', data.mobilePhone);
                setVal('fax', data.fax);
                setVal('address', data.address);
                setVal('notes', data.memo);

                // カスタム項目のセット
                if (data.customData) {
                    for (const key in data.customData) {
                        setVal(`custom_${key}`, data.customData[key]);
                    }
                }

            } else {
                console.error("名刺データが見つかりません:", id);
            }
        } catch (error) {
            console.error("データ取得エラー:", error);
        }
    }

    if (cardForm) {
        cardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitButton.disabled = true;
            messageArea.textContent = '保存処理中...';
            messageArea.className = 'text-blue-600 mb-4 font-bold';

            const company = document.getElementById('company').value.trim();
            const name = document.getElementById('name').value.trim();

            if (!company || !name) {
                messageArea.textContent = 'エラー: 「会社名・組織名」と「氏名」は必須項目です。';
                messageArea.className = 'text-red-500 mb-4 font-bold';
                submitButton.disabled = false;
                return;
            }

            const cardData = {
                companyName: company,
                department: document.getElementById('department').value.trim(),
                position: document.getElementById('title').value.trim(),
                name: name,
                email: document.getElementById('email') ? document.getElementById('email').value.trim() : "",
                companyPhone: document.getElementById('company_tel') ? document.getElementById('company_tel').value.trim() : "",
                mobilePhone: document.getElementById('mobile_tel') ? document.getElementById('mobile_tel').value.trim() : "",
                fax: document.getElementById('fax') ? document.getElementById('fax').value.trim() : "",
                address: document.getElementById('address') ? document.getElementById('address').value.trim() : "",
                memo: document.getElementById('notes') ? document.getElementById('notes').value.trim() : "",
                customData: {},
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // カスタム項目の収集
            customFieldsDef.forEach(field => {
                const el = document.getElementById(`custom_${field.key}`);
                if (el) {
                    cardData.customData[field.key] = el.value.trim();
                }
            });

                try {
                    let savedCardId = cardId;
                    if (cardId) {
                        const cardRef = db.collection('businessCards').doc(cardId);
                        
                        // 履歴保存のために現在のデータを取得
                        const currentDoc = await cardRef.get();
                        if (currentDoc.exists) {
                            const oldData = currentDoc.data();
                            await cardRef.collection('history').add({
                                ...oldData,
                                archivedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }

                        await cardRef.update(cardData);
                    } else {
                        // 新規作成：SessionStorageに画像があれば含める
                        cardData.ownerId = currentUser.uid;
                        cardData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        if (draftData && draftData.imageUrl) {
                            cardData.imageUrl = draftData.imageUrl;
                        }
                        const docRef = await db.collection('businessCards').add(cardData);
                        savedCardId = docRef.id;
                        // 登録が完了したら一時データを削除
                        sessionStorage.removeItem('ocrDraft');
                    }

                if (cardId) {
                    messageArea.textContent = '名刺情報を更新しました！完了画面へ移動します。';
                    messageArea.className = 'text-green-600 mb-4 font-bold';
                    submitButton.disabled = false;
                    setTimeout(() => {
                        window.location.href = `/business_card_detail.html?id=${savedCardId}`;
                    }, 1000);
                } else {
                    messageArea.textContent = '名刺情報を保存しました！完了画面へ移動します。';
                    messageArea.className = 'text-green-600 mb-4 font-bold';
                    setTimeout(() => {
                        window.location.href = `/business_card_registered.html?id=${savedCardId}`;
                    }, 1000);
                }

            } catch (error) {
                console.error('Error saving document: ', error);
                messageArea.textContent = `エラーが発生しました: ${error.message}`;
                messageArea.className = 'text-red-500 mb-4 font-bold';
                submitButton.disabled = false;
            }
        });
    }
});
