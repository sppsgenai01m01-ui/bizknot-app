
// --- Backend APIのベースURL ---
// RenderでデプロイしたバックエンドサービスのURLをここに設定します。
const API_BASE_URL = 'https://bizknot-app-backend.onrender.com';

// --- Firebase SDK の初期化 ---
// この設定はFirebaseコンソールから取得したものです。
const firebaseConfig = {
    apiKey: "AIzaSyDGYmSxCNuf5bpZfQe5e-T0bvUXkU6zXfg",
    authDomain: "bizknot-asever.firebaseapp.com",
    projectId: "bizknot-asever",
    storageBucket: "bizknot-asever.appspot.com",
    messagingSenderId: "103308146429",
    appId: "1:103308146429:web:474099dc997f0dc85b3094",
    measurementId: "G-HS0D118SW1"
};

firebase.initializeApp(firebaseConfig);

// --- ローカル開発時のエミュレーター設定 ---
// 公開環境ではここは実行されません。
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("ローカル環境を検出しました。Firebaseエミュレータに接続します。");
    firebase.auth().useEmulator("http://127.0.0.1:9099");
}


// --- DOM要素の取得 ---
const loginButton = document.getElementById('login-button');
const errorMessage = document.getElementById('error-message');

// --- ログイン処理 ---
if (loginButton) {
    loginButton.addEventListener('click', () => {
        loginButton.disabled = true;
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';

        const provider = new firebase.auth.GoogleAuthProvider();

        firebase.auth().signInWithPopup(provider)
            .then(result => {
                // ログイン成功後、すぐにIDトークンを取得
                return result.user.getIdToken();
            })
            .then(idToken => {
                // IDトークンをセッションストレージに保存
                sessionStorage.setItem('firebaseIdToken', idToken);
                // ダッシュボードへリダイレクト
                window.location.href = 'dashboard.html';
            })
            .catch(error => {
                console.error("ログインまたはトークン取得に失敗しました:", error);
                errorMessage.textContent = 'ログインに失敗しました。もう一度お試しください。';
                resetLoginButton();
            });
    });
}

// --- 共通のAPI呼び出し関数 ---
// バックエンドとの通信を担う重要な関数
async function callApi(endpoint, method = 'GET', body = null) {
    const token = sessionStorage.getItem('firebaseIdToken');
    if (!token) {
        console.error('IDトークンが見つかりません。ログインページにリダイレクトします。');
        window.location.href = 'index.html';
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const options = {
        method: method,
        headers: headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            // 4xx, 5xx系エラーの場合
            const errorData = await response.json();
            throw new Error(errorData.message || `サーバーエラー: ${response.status}`);
        }
        // 204 No Content のようにボディがない場合を考慮
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return; 
        }
    } catch (error) {
        console.error(`API呼び出しエラー (${endpoint}):`, error);
        // ここでUIにエラーメッセージを表示するなどの処理を追加できる
        throw error;
    }
}


// --- ログインボタンの状態をリセットする関数 ---
function resetLoginButton() {
    if (loginButton) {
        loginButton.disabled = false;
        loginButton.innerHTML = 'Googleでログイン';
    }
}
