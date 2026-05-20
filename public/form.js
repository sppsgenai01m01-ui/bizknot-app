document.addEventListener('DOMContentLoaded', () => {
    // Firebaseの初期化が完了しているかを確認
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    const cardForm = document.getElementById('card-form');
    const messageArea = document.getElementById('message-area');
    const submitButton = document.getElementById('submit-button');

    // ユーザーのログイン状態を確認
    auth.onAuthStateChanged(user => {
        if (!user) {
            // ユーザーがログインしていない場合は、ログインページにリダイレクト
            console.log('User is not logged in. Redirecting to login page.');
            window.location.href = 'index.html';
        }
    });

    if (cardForm) {
        cardForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // デフォルトのフォーム送信をキャンセル
            submitButton.disabled = true;
            messageArea.textContent = '登録処理中...';
            messageArea.className = 'message-info';

            const user = auth.currentUser;
            if (!user) {
                messageArea.textContent = 'エラー: ログインしていません。ログインページに戻ってください。';
                messageArea.className = 'message-error';
                submitButton.disabled = false;
                return;
            }

            // フォームからデータを取得
            const company = document.getElementById('company').value.trim();
            const name = document.getElementById('name').value.trim();

            // 必須項目のバリデーション
            if (!company || !name) {
                messageArea.textContent = 'エラー: 「会社名・組織名」と「氏名」は必須項目です。';
                messageArea.className = 'message-error';
                submitButton.disabled = false;
                return;
            }

            try {
                // ユーザーのIDトークンを取得
                const idToken = await user.getIdToken(true);

                // バックエンドAPIに送信するデータを構築
                const cardData = {
                    company: company,
                    department: document.getElementById('department').value.trim(),
                    title: document.getElementById('title').value.trim(),
                    name: name,
                    email: document.getElementById('email').value.trim(),
                    tel: document.getElementById('tel').value.trim(),
                    address: document.getElementById('address').value.trim(),
                    notes: document.getElementById('notes').value.trim(),
                };

                // ★修正点：ハードコードされた誤ったURLを削除し、app.jsで定義された変数を参照するように変更
                const backendUrl = `${API_BASE_URL}/api/cards`;

                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + idToken
                    },
                    body: JSON.stringify(cardData)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`サーバーからの応答が不正です: ${errorText}`);
                }

                // 成功メッセージを表示し、名刺一覧ページへリダイレクト
                messageArea.textContent = '名刺の登録に成功しました！一覧ページに移動します。';
                messageArea.className = 'message-success';

                setTimeout(() => {
                    window.location.href = 'business_card_list.html';
                }, 2000);

            } catch (error) {
                console.error('Error adding document via backend: ', error);
                messageArea.textContent = `エラーが発生しました: ${error.message}`;
                messageArea.className = 'message-error';
                submitButton.disabled = false;
            }
        });
    }
});
