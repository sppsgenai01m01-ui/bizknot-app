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

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            if (cardId) {
                loadCardData(cardId);
            }
        } else {
            window.location.href = 'index.html';
        }
    });

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

                // フォームへの自動入力
                if (data.companyName) document.getElementById('company').value = data.companyName;
                if (data.department) document.getElementById('department').value = data.department;
                if (data.position) document.getElementById('title').value = data.position;
                if (data.name) document.getElementById('name').value = data.name;
                if (data.email) document.getElementById('email').value = data.email;
                if (data.phone) document.getElementById('tel').value = data.phone;
                if (data.address) document.getElementById('address').value = data.address;
                if (data.memo) document.getElementById('notes').value = data.memo;

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
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('tel').value.trim(),
                address: document.getElementById('address').value.trim(),
                memo: document.getElementById('notes').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                let savedCardId = cardId;
                if (cardId) {
                    // 更新
                    await db.collection('businessCards').doc(cardId).update(cardData);
                } else {
                    // 新規作成
                    cardData.ownerId = currentUser.uid;
                    cardData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    const docRef = await db.collection('businessCards').add(cardData);
                    savedCardId = docRef.id;
                }

                messageArea.textContent = '名刺情報を保存しました！完了画面へ移動します。';
                messageArea.className = 'text-green-600 mb-4 font-bold';

                setTimeout(() => {
                    window.location.href = `/business_card_registered.html?id=${savedCardId}`;
                }, 1000);

            } catch (error) {
                console.error('Error saving document: ', error);
                messageArea.textContent = `エラーが発生しました: ${error.message}`;
                messageArea.className = 'text-red-500 mb-4 font-bold';
                submitButton.disabled = false;
            }
        });
    }
});
