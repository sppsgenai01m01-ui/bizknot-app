document.addEventListener('DOMContentLoaded', () => {
    // Firebaseの初期化が完了しているかを確認
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();

    // DOM要素の取得
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');

    // ログインボタンが存在する場合のみ処理を実行
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            loginButton.disabled = true;
            loginButton.textContent = '処理中...';

            const provider = new firebase.auth.GoogleAuthProvider();

            auth.signInWithPopup(provider)
                .then(result => {
                    const user = result.user;
                    const email = user.email;
                    
                    // 許可するドメインのリスト
                    const ALLOWED_DOMAINS = ['spps.co.jp', 'gmail.com'];
                    const domain = email.substring(email.lastIndexOf('@') + 1);

                    if (!ALLOWED_DOMAINS.includes(domain)) {
                        // ログアウト処理
                        auth.signOut().then(() => {
                            console.warn(`ドメイン (${domain}) は許可されていません。`);
                            if (errorMessage) {
                                errorMessage.textContent = `このドメイン (${domain}) からのログインは許可されていません。`;
                                errorMessage.className = 'bg-yellow-100 text-yellow-700 p-3 rounded mb-4 font-bold';
                            }
                            resetLoginButton();
                        });
                        return;
                    }

                    // ログイン成功後、ダッシュボードへリダイレクト
                    window.location.href = 'dashboard.html';
                })
                .catch(error => {
                    console.error("ログインに失敗しました:", error);
                    if (errorMessage) {
                        errorMessage.textContent = 'ログインに失敗しました。もう一度お試しください。';
                        errorMessage.className = 'bg-red-100 text-red-700 p-3 rounded mb-4 font-bold';
                    }
                    resetLoginButton();
                });
        });
    }

    // ログインボタンの状態をリセットする関数
    function resetLoginButton() {
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Googleでログイン';
        }
    }
});
