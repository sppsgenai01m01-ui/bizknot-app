document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            loginButton.disabled = true;
            loginButton.textContent = '処理中...';
            const provider = new firebase.auth.GoogleAuthProvider();

            auth.signInWithPopup(provider)
                .then(result => {
                    const user = result.user;
                    if (!user || !user.email) {
                        throw new Error("ユーザー情報が取得できませんでした。");
                    }

                    // 🛡️ ドメイン制限チェック
                    const email = user.email.toLowerCase();
                    if (!email.endsWith('@spps.co.jp') && !email.endsWith('@gmail.com')) {
                        // 許可されていないドメインの場合は強制ログアウト
                        return auth.signOut().then(() => {
                            throw new Error("許可されていないメールドメインです。(@spps.co.jp または @gmail.com のみ可能)");
                        });
                    }

                    // ドメインチェックを通過したらダッシュボードへ
                    window.location.href = 'dashboard.html';
                })
                .catch(error => {
                    console.error("ログインに失敗しました:", error);
                    if (errorMessage) {
                        // エラーメッセージを画面に表示
                        errorMessage.textContent = error.message.includes("許可されていない") 
                            ? error.message 
                            : 'ログインに失敗しました。ポップアップがブロックされていないか確認し、もう一度お試しください。';
                    }
                    resetLoginButton();
                });
        });
    }

    function resetLoginButton() {
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Googleでログイン';
        }
    }
});