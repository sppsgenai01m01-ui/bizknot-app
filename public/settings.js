document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements
    const fieldListBody = document.getElementById('field-list-body');
    const addFieldButton = document.getElementById('add-field-button');
    const addFieldModal = document.getElementById('add-field-modal');
    const fieldModalTitle = document.getElementById('field-modal-title');
    const editFieldId = document.getElementById('edit-field-id');
    const fieldLabel = document.getElementById('field-label');
    const fieldKey = document.getElementById('field-key');
    const fieldType = document.getElementById('field-type');
    const fieldIsRequired = document.getElementById('field-is-required');
    const saveFieldButton = document.getElementById('save-field-button');
    const cancelFieldButton = document.getElementById('cancel-field-button');

    auth.onAuthStateChanged(user => {
        if (user) {
            initializeSettingsPage();
        } else {
            window.location.href = '/';
        }
    });

    function initializeSettingsPage() {
        if(fieldListBody) loadCustomFields();
        setupEventListeners();
    }

    function setupEventListeners() {
        if(addFieldButton) addFieldButton.addEventListener('click', openAddFieldModal);
        if(cancelFieldButton) cancelFieldButton.addEventListener('click', () => addFieldModal.classList.add('hidden'));
        if(saveFieldButton) saveFieldButton.addEventListener('click', saveCustomField);

        if(fieldListBody) {
            fieldListBody.addEventListener('click', (event) => {
                const target = event.target;
                const fieldId = target.closest('tr')?.dataset.id;
                if (!fieldId) return;

                if (target.classList.contains('edit-field-button')) {
                    // Edit modal logic (placeholder)
                    alert('編集機能は準備中です: ' + fieldId);
                }
                if (target.classList.contains('delete-field-button')) {
                    deleteCustomField(fieldId);
                }
            });
        }
    }

    async function loadCustomFields() {
        try {
            const snapshot = await db.collection('customFields').orderBy('label').get();
            fieldListBody.innerHTML = ''; 

            if (snapshot.empty) {
                fieldListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">カスタム項目が登録されていません。</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const field = doc.data();
                const row = document.createElement('tr');
                row.dataset.id = doc.id; 
                
                const requiredBadge = field.isRequired
                    ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">必須</span>'
                    : '';

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${field.label}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${field.key}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${field.type}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${requiredBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-indigo-600 hover:text-indigo-900 edit-field-button">編集</button>
                        <button class="ml-4 text-red-600 hover:text-red-900 delete-field-button">削除</button>
                    </td>
                `;
                fieldListBody.appendChild(row);
            });

        } catch (error) {
            console.error("Error loading custom fields: ", error);
            fieldListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">項目の読み込みに失敗しました。</td></tr>';
        }
    }

    function openAddFieldModal() {
        fieldModalTitle.textContent = '新規カスタム項目の追加';
        editFieldId.value = ''; 
        fieldLabel.value = '';
        fieldKey.value = '';
        fieldType.value = 'text';
        fieldIsRequired.checked = false;
        fieldKey.disabled = false; 
        addFieldModal.classList.remove('hidden');
    }

    async function saveCustomField() {
        const fieldId = editFieldId.value;
        const label = fieldLabel.value.trim();
        const key = fieldKey.value.trim();
        const type = fieldType.value;
        const isRequired = fieldIsRequired.checked;

        if (!label || !key) {
            alert('項目名と項目IDは必須です。');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(key)) {
            alert('項目IDは英数字とアンダースコア(_)のみ使用できます。');
            return;
        }

        saveFieldButton.disabled = true;
        saveFieldButton.textContent = '保存中...';

        try {
            const data = { label, key, type, isRequired, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            
            if (fieldId) {
                // 更新
                const docRef = db.collection('customFields').doc(fieldId);
                await docRef.update(data);
            } else {
                // 新規追加
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('customFields').add(data);
            }

            addFieldModal.classList.add('hidden');
            await loadCustomFields(); 

        } catch (error) {
            console.error("Error saving custom field: ", error);
            alert('項目の保存に失敗しました。');
        } finally {
            saveFieldButton.disabled = false;
            saveFieldButton.textContent = '保存';
        }
    }

    async function deleteCustomField(id) {
        if (confirm('このカスタム項目を削除しますか？')) {
            try {
                await db.collection('customFields').doc(id).delete();
                await loadCustomFields();
            } catch(e) {
                alert('削除に失敗しました。');
            }
        }
    }
});
