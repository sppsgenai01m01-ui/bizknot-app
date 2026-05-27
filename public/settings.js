document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements - Tabs
    const tabCustomFields = document.getElementById('tab-custom-fields');
    const tabAiSettings = document.getElementById('tab-ai-settings');
    const contentCustomFields = document.getElementById('content-custom-fields');
    const contentAiSettings = document.getElementById('content-ai-settings');

    // DOM Elements - Custom Fields
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

    // DOM Elements - AI Settings
    const alertPeriodInput = document.getElementById('alert-period-input');
    const saveAlertPeriodBtn = document.getElementById('save-alert-period-btn');
    const promptList = document.getElementById('prompt-list');
    const addPromptBtn = document.getElementById('add-prompt-btn');
    const aiPromptModal = document.getElementById('ai-prompt-modal');
    const promptModalTitle = document.getElementById('prompt-modal-title');
    const editPromptId = document.getElementById('edit-prompt-id');
    const promptTitleInput = document.getElementById('prompt-title');
    const promptTextInput = document.getElementById('prompt-text');
    const savePromptBtn = document.getElementById('save-prompt-btn');
    const cancelPromptBtn = document.getElementById('cancel-prompt-btn');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().permission === 'admin') {
                    initializeSettingsPage(); 
                } else {
                    alert("このページにアクセスする権限がありません。");
                    window.location.href = '/dashboard.html';
                }
            } catch (e) {
                window.location.href = '/dashboard.html';
            }
        } else {
            window.location.href = '/';
        }
    });

    function initializeSettingsPage() {
        setupTabListeners();
        setupEventListeners();
        loadCustomFields();
        loadAiSettings();
    }

    function setupTabListeners() {
        if (!tabCustomFields || !tabAiSettings) return;

        tabCustomFields.addEventListener('click', () => {
            tabCustomFields.classList.replace('border-transparent', 'border-blue-500');
            tabCustomFields.classList.replace('text-gray-500', 'text-blue-600');
            tabAiSettings.classList.replace('border-blue-500', 'border-transparent');
            tabAiSettings.classList.replace('text-blue-600', 'text-gray-500');
            
            if(contentCustomFields) contentCustomFields.classList.remove('hidden');
            if(contentAiSettings) contentAiSettings.classList.add('hidden');
        });

        tabAiSettings.addEventListener('click', () => {
            tabAiSettings.classList.replace('border-transparent', 'border-blue-500');
            tabAiSettings.classList.replace('text-gray-500', 'text-blue-600');
            tabCustomFields.classList.replace('border-blue-500', 'border-transparent');
            tabCustomFields.classList.replace('text-blue-600', 'text-gray-500');
            
            if(contentAiSettings) contentAiSettings.classList.remove('hidden');
            if(contentCustomFields) contentCustomFields.classList.add('hidden');
        });
    }

    function setupEventListeners() {
        // Custom Fields
        if(addFieldButton) addFieldButton.addEventListener('click', openAddFieldModal);
        if(cancelFieldButton) cancelFieldButton.addEventListener('click', () => addFieldModal.classList.add('hidden'));
        if(saveFieldButton) saveFieldButton.addEventListener('click', saveCustomField);

        if(fieldListBody) {
            fieldListBody.addEventListener('click', (event) => {
                const target = event.target;
                const fieldId = target.closest('tr')?.dataset.id;
                if (!fieldId) return;

                if (target.classList.contains('edit-field-button')) editCustomField(fieldId);
                if (target.classList.contains('delete-field-button')) deleteCustomField(fieldId);
            });
        }

        // AI Settings
        if (saveAlertPeriodBtn) saveAlertPeriodBtn.addEventListener('click', saveAlertPeriod);
        if (addPromptBtn) addPromptBtn.addEventListener('click', openAddPromptModal);
        if (cancelPromptBtn) cancelPromptBtn.addEventListener('click', () => aiPromptModal.classList.add('hidden'));
        if (savePromptBtn) savePromptBtn.addEventListener('click', savePrompt);

        if (promptList) {
            promptList.addEventListener('click', (event) => {
                const target = event.target;
                const promptId = target.closest('li')?.dataset.id;
                if (!promptId) return;

                if (target.classList.contains('edit-prompt-button')) editPrompt(promptId);
                if (target.classList.contains('delete-prompt-button')) deletePrompt(promptId);
            });
        }
    }

    // --- Custom Fields Logic ---

    async function loadCustomFields() {
        try {
            const snapshot = await db.collection('fieldDefinitions').orderBy('label').get();
            if(!fieldListBody) return;
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
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(field.label)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${escapeHTML(field.key)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHTML(field.type)}</td>
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
            if(fieldListBody) fieldListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">項目の読み込みに失敗しました。</td></tr>';
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

    async function editCustomField(id) {
        try {
            const doc = await db.collection('fieldDefinitions').doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                fieldModalTitle.textContent = 'カスタム項目の編集';
                editFieldId.value = id;
                fieldLabel.value = data.label;
                fieldKey.value = data.key;
                fieldType.value = data.type;
                fieldIsRequired.checked = data.isRequired;
                fieldKey.disabled = true;
                addFieldModal.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
            alert("データの取得に失敗しました。");
        }
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
                await db.collection('fieldDefinitions').doc(fieldId).update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('fieldDefinitions').add(data);
            }
            addFieldModal.classList.add('hidden');
            await loadCustomFields(); 
        } catch (error) {
            console.error(error);
            alert('項目の保存に失敗しました。');
        } finally {
            saveFieldButton.disabled = false;
            saveFieldButton.textContent = '保存';
        }
    }

    async function deleteCustomField(id) {
        if (confirm('このカスタム項目を削除しますか？')) {
            try {
                await db.collection('fieldDefinitions').doc(id).delete();
                await loadCustomFields();
            } catch(e) {
                alert('削除に失敗しました。');
            }
        }
    }

    // --- AI Settings Logic ---

    async function loadAiSettings() {
        // Alert Period
        try {
            const doc = await db.collection('appSettings').doc('aiApproach').get();
            if (doc.exists && doc.data().alertPeriodMonths) {
                if(alertPeriodInput) alertPeriodInput.value = doc.data().alertPeriodMonths;
            } else {
                if(alertPeriodInput) alertPeriodInput.value = 6; // default 6 months
            }
        } catch (error) {
            console.error("Error loading alert period", error);
        }

        // Prompts
        await loadPrompts();
    }

    async function loadPrompts() {
        try {
            const snapshot = await db.collection('aiprompts').orderBy('createdAt', 'desc').get();
            if (!promptList) return;
            promptList.innerHTML = '';
            
            if (snapshot.empty) {
                promptList.innerHTML = '<li class="py-4 text-center text-gray-500">プロンプトが登録されていません。</li>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const li = document.createElement('li');
                li.className = "py-4 flex justify-between items-center";
                li.dataset.id = doc.id;
                li.innerHTML = `
                    <div class="flex-1 min-w-0 pr-4">
                        <p class="text-sm font-medium text-gray-900 truncate">${escapeHTML(data.title)}</p>
                        <p class="text-sm text-gray-500 truncate">${escapeHTML(data.text)}</p>
                    </div>
                    <div class="flex-shrink-0 flex gap-2">
                        <button class="text-indigo-600 hover:text-indigo-900 text-sm font-medium edit-prompt-button">編集</button>
                        <button class="text-red-600 hover:text-red-900 text-sm font-medium delete-prompt-button">削除</button>
                    </div>
                `;
                promptList.appendChild(li);
            });
        } catch (error) {
            console.error(error);
        }
    }

    async function saveAlertPeriod() {
        const val = parseInt(alertPeriodInput.value, 10);
        if (isNaN(val) || val < 1 || val > 60) {
            alert('1〜60の範囲で月数を入力してください。');
            return;
        }

        try {
            saveAlertPeriodBtn.textContent = '保存中...';
            saveAlertPeriodBtn.disabled = true;
            await db.collection('appSettings').doc('aiApproach').set({
                alertPeriodMonths: val,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            alert('保存しました。');
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。');
        } finally {
            saveAlertPeriodBtn.textContent = '保存';
            saveAlertPeriodBtn.disabled = false;
        }
    }

    function openAddPromptModal() {
        promptModalTitle.textContent = 'AIプロンプトの追加';
        editPromptId.value = '';
        promptTitleInput.value = '';
        promptTextInput.value = '';
        aiPromptModal.classList.remove('hidden');
    }

    async function editPrompt(id) {
        try {
            const doc = await db.collection('aiprompts').doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                promptModalTitle.textContent = 'AIプロンプトの編集';
                editPromptId.value = id;
                promptTitleInput.value = data.title;
                promptTextInput.value = data.text;
                aiPromptModal.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
            alert('データの取得に失敗しました。');
        }
    }

    async function savePrompt() {
        const id = editPromptId.value;
        const title = promptTitleInput.value.trim();
        const text = promptTextInput.value.trim();

        if (!title || !text) {
            alert('タイトルとプロンプト内容は必須です。');
            return;
        }

        try {
            savePromptBtn.textContent = '保存中...';
            savePromptBtn.disabled = true;
            
            const data = { title, text, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

            if (id) {
                await db.collection('aiprompts').doc(id).update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('aiprompts').add(data);
            }
            aiPromptModal.classList.add('hidden');
            await loadPrompts();
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。');
        } finally {
            savePromptBtn.textContent = '保存';
            savePromptBtn.disabled = false;
        }
    }

    async function deletePrompt(id) {
        if (confirm('このプロンプトを削除しますか？')) {
            try {
                await db.collection('aiprompts').doc(id).delete();
                await loadPrompts();
            } catch (error) {
                console.error(error);
                alert('削除に失敗しました。');
            }
        }
    }

    const escapeHTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
});
