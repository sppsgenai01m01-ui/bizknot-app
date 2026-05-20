
// (Firebase初期化は変更なし)

// --- DOM要素 ---
// (ユーザー管理関連は変更なし)

// ▼▼ カスタム項目関連のDOM要素を追加 ▼▼
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


// --- 初期化処理 ---
// (変更なし)
document.addEventListener('DOMContentLoaded', () => { /* ... */ });

function initializeSettingsPage() {
    loadUsers();
    loadCustomFields(); // ★ カスタム項目読み込みを追加
    setupEventListeners();
}

// --- イベントリスナー設定 ---
function setupEventListeners() {
    // (ユーザー管理関連は変更なし)

    // ▼▼ カスタム項目関連のイベントリスナーを追加 ▼▼
    addFieldButton.addEventListener('click', openAddFieldModal);
    cancelFieldButton.addEventListener('click', () => addFieldModal.classList.add('hidden'));
    saveFieldButton.addEventListener('click', saveCustomField);

    // 編集・削除ボタンのイベントリスナー (イベント委任)
    fieldListBody.addEventListener('click', (event) => {
        const target = event.target;
        const fieldId = target.closest('tr')?.dataset.id;
        if (!fieldId) return;

        if (target.classList.contains('edit-field-button')) {
            openEditFieldModal(fieldId);
        }
        if (target.classList.contains('delete-field-button')) {
            deleteCustomField(fieldId);
        }
    });
}

// --- カスタム項目の一覧読み込み ---
async function loadCustomFields() {
    try {
        const snapshot = await db.collection('customFields').orderBy('label').get();
        fieldListBody.innerHTML = ''; // テーブルをクリア

        if (snapshot.empty) {
            fieldListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">カスタム項目が登録されていません。</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const field = doc.data();
            const row = document.createElement('tr');
            row.dataset.id = doc.id; // 行にドキュメントIDを付与
            
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

// --- 新規項目追加モーダルを開く ---
function openAddFieldModal() {
    fieldModalTitle.textContent = '新規カスタム項目の追加';
    editFieldId.value = ''; // 編集IDをクリア
    fieldLabel.value = '';
    fieldKey.value = '';
    fieldType.value = 'text';
    fieldIsRequired.checked = false;
    fieldKey.disabled = false; // キーを編集可能に
    addFieldModal.classList.remove('hidden');
}

// --- カスタム項目の保存・更新 ---
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
        await loadCustomFields(); // 一覧を更新

    } catch (error) {
        console.error("Error saving custom field: ", error);
        alert('項目の保存に失敗しました。');
    } finally {
        saveFieldButton.disabled = false;
        saveFieldButton.textContent = '保存';
    }
}

// (ユーザー管理の各種関数は変更なし) 

