
// Firebase SDK の初期化
const firebaseConfig = {
    apiKey: "AIzaSyDGYmSxCNuf5bpZfQe5e-T0bvUXkU6zXfg",
    authDomain: "bizknot-asever.firebaseapp.com",
    projectId: "bizknot-asever",
    storageBucket: "bizknot-asever.firebasestorage.app",
    messagingSenderId: "103308146429",
    appId: "1:103308146429:web:474099dc997f0dc85b3094",
    measurementId: "G-HS0D118SW1"
};

firebase.initializeApp(firebaseConfig);

// 現在のURLが localhost や 127.0.0.1 の場合のみエミュレーターを使用する
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("ローカル環境を検出しました。エミュレータに接続します。");
    firebase.auth().useEmulator("http://127.0.0.1:9099");
    firebase.firestore().useEmulator("127.0.0.1", 8081);
}


// DOM要素の取得
const loginButton = document.getElementById('login-button');
const errorMessage = document.getElementById('error-message');

// ログインボタンのクリックイベント
loginButton.addEventListener('click', () => {
    // ボタンをローディング状態にする
    loginButton.disabled = true;
    loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';

    // GoogleAuthProvider のインスタンスを作成
    const provider = new firebase.auth.GoogleAuthProvider();

    // signInWithPopup でログイン
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            // ログイン成功
            const user = result.user;

            // Firestoreからユーザー権限を取得
            const db = firebase.firestore();
            db.collection('users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        // ユーザー情報に権限を追加
                        const permission = doc.data().permission;
                        // TODO: セッションストレージに保存

                        // ダッシュボードにリダイレクト
                        window.location.href = 'dashboard.html';
                    } else {
                        // ユーザー情報が存在しない場合
                        errorMessage.textContent = 'ユーザー情報が登録されていません。';
                        firebase.auth().signOut();
                        resetLoginButton();
                    }
                })
                .catch((error) => {
                    // Firestoreからのデータ取得に失敗
                    console.error('Error getting document:', error);
                    errorMessage.textContent = 'エラーが発生しました。';
                    firebase.auth().signOut();
                    resetLoginButton();
                });

        })
        .catch((error) => {
            // ログイン失敗
            console.error("Login Failed:", error);
            errorMessage.textContent = 'ログインに失敗しました。';
            resetLoginButton();
        });
});

// ボタンの状態をリセットする関数
function resetLoginButton() {
    loginButton.disabled = false;
    loginButton.innerHTML = 'Googleでログイン';
}
