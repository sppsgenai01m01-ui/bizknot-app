
const auth = firebase.auth();

// DOM要素の取得
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-btn');
const googleLoginButton = document.getElementById('google-login-btn');
const microsoftLoginButton = document.getElementById('microsoft-login-btn');
const errorMessage = document.getElementById('error-message');

// --- 認証状態の監視 ---
auth.onAuthStateChanged(user => {
    if (user) {
        // ユーザーがログイン済みの場合、名刺一覧ページにリダイレクト
        console.log('ログイン済みのため、一覧ページに遷移します。', user);
        // window.location.href = 'SCR-006-list.html'; // NOTE: SCR-006 実装後に有効化
    }
});

// --- メール/パスワードでのログイン ---
if (loginButton) {
    loginButton.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        // バリデーション
        errorMessage.textContent = '';
        if (!email || !password) {
            errorMessage.textContent = 'メールアドレスとパスワードを入力してください。';
            return;
        }
        if (!validateEmail(email)) {
            errorMessage.textContent = '有効なメールアドレスを入力してください。';
            return;
        }

        setLoading(true);
        try {
            await auth.signInWithEmailAndPassword(email, password);
            console.log('メール/パスワードでのログイン成功');
            window.location.href = 'list.html'; // ログイン成功後の遷移先
        } catch (error) {
            console.error('ログインエラー:', error);
            errorMessage.textContent = getFirebaseAuthErrorMessage(error.code);
        } finally {
            setLoading(false);
        }
    });
}

// --- Googleでのログイン ---
if (googleLoginButton) {
    googleLoginButton.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        await signInWithProvider(provider);
    });
}

// --- Microsoftでのログイン ---
if (microsoftLoginButton) {
    microsoftLoginButton.addEventListener('click', async () => {
        const provider = new firebase.auth.OAuthProvider('microsoft.com');
        await signInWithProvider(provider);
    });
}

// --- プロバイダーを使ったサインインの共通処理 ---
asynce function signInWithProvider(provider) {
    setLoading(true);
    try {
        await auth.signInWithPopup(provider);
        console.log(`${provider.providerId}でのログイン成功`);
        window.location.href = 'list.html'; // ログイン成功後の遷移先
    } catch (error) {
        console.error(`${provider.providerId}ログインエラー:`, error);
        errorMessage.textContent = getFirebaseAuthErrorMessage(error.code);
    } finally {
        setLoading(false);
    }
}


// --- ヘルパー関数 ---

// 読み込み状態のUI制御
function setLoading(isLoading) {
    if (loginButton) loginButton.disabled = isLoading;
    if (googleLoginButton) googleLoginButton.disabled = isLoading;
    if (microsoftLoginButton) microsoftLoginButton.disabled = isLoading;
    if (loginButton) loginButton.textContent = isLoading ? 'ログイン中...' : 'ログイン';
}

// メールアドレスの形式を検証
function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Firebase Authのエラーコードを日本語メッセージに変換
function getFirebaseAuthErrorMessage(code) {
    switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'メールアドレスまたはパスワードが正しくありません。';
        case 'auth/invalid-email':
            return '有効なメールアドレスを入力してください。';
        case 'auth/user-disabled':
            return 'このアカウントは無効になっています。';
        case 'auth/too-many-requests':
            return '試行回数が上限を超えました。しばらくしてからもう一度お試しください。';
        case 'auth/popup-closed-by-user':
            return 'ログインウィンドウが閉じられました。もう一度お試しください。';
        case 'auth/cancelled-popup-request':
            return '複数のログインウィンドウが開かれました。処理を中断します。';
        default:
            return 'ログインに失敗しました。しばらくしてからもう一度お試しください。';
    }
}

// ユーザーが入力し始めたらエラーメッセージを消す
if(emailInput && passwordInput) {
    emailInput.addEventListener('input', () => { errorMessage.textContent = ''; });
    passwordInput.addEventListener('input', () => { errorMessage.textContent = ''; });
}
