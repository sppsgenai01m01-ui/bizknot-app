
// (Firebase初期化は変更なし)

// DOM要素
const container = document.getElementById('detail-container');
// (中略)
const addressField = document.getElementById('address-field');
const customFieldsDisplayContainer = document.getElementById('custom-fields-display');
const customFieldsListDisplay = document.getElementById('custom-fields-list-display');
const editButton = document.getElementById('edit-button');
// (中略)

// (認証とIDのチェックは変更なし)

// 名刺詳細データの取得と表示
async function fetchCardDetails() {
    try {
        const doc = await db.collection('businessCards').doc(cardId).get();

        if (doc.exists) {
            const data = doc.data();

            // (論理削除チェックは変更なし)

            // (基本情報の表示は変更なし)
            // (中略)
            if(data.address) { /* ... */ }
            
            // ▼▼ カスタム項目の表示処理を呼び出し ▼▼
            await renderCustomFields(data.customData);

            // (ローディング完了処理は変更なし)

        } else {
            alert('名刺データが見つかりません。');
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        alert('データの読み込みに失敗しました。');
    }
}

// ★★★ カスタム項目を描画する新関数 ★★★
async function renderCustomFields(customData) {
    // カスタムデータがない、または空オブジェクトの場合はコンテナごと非表示
    if (!customData || Object.keys(customData).length === 0) {
        customFieldsDisplayContainer.style.display = 'none';
        return;
    }

    // カスタム項目の定義(key -> label)をMapとして取得
    const fieldDefs = await getCustomFieldDefinitions();

    customFieldsListDisplay.innerHTML = ''; // 表示エリアをクリア
    let contentAdded = false;

    // customDataの各キーに対して処理
    for (const key in customData) {
        const value = customData[key];
        // 値が存在し、かつフィールド定義にも存在するキーのみ表示
        if (value && fieldDefs.has(key)) {
            const label = fieldDefs.get(key);
            const fieldEl = document.createElement('div');
            fieldEl.classList.add('text-sm');
            // ラベルと値を表示するHTMLを生成
            fieldEl.innerHTML = `
                <dt class="font-semibold text-gray-600">${label}:</dt>
                <dd class="text-gray-800 pl-2">${value}</dd>
            `;
            customFieldsListDisplay.appendChild(fieldEl);
            contentAdded = true;
        }
    }

    // 表示する内容が一つもなければ、やはりコンテナを隠す
    if (!contentAdded) {
        customFieldsDisplayContainer.style.display = 'none';
    }
}

// ★★★ カスタム項目の定義をMapで取得するヘルパー関数 ★★★
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


// (イベントリスナーは変更なし)

