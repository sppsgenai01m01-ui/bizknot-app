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
            // Font Awesomeなどのアイコンライブラリがないため、テキストで表示
            loginButton.textContent = '処理中...';

            const provider = new firebase.auth.GoogleAuthProvider();

            auth.signInWithPopup(provider)
                .then(result => {
                    // ログイン成功後、ダッシュボードへリダイレクト
                    window.location.href = 'dashboard.html';
                })
                .catch(error => {
                    console.error("ログインに失敗しました:", error);
                    if (errorMessage) {
                        errorMessage.textContent = 'ログインに失敗しました。ポップアップがブロックされていないか確認し、もう一度お試しください。';
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
