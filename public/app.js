// --- 設定情報 ---
// このファイルは、すべてのページで最初に読み込まれ、各種設定を一元管理します。

// バックエンドAPIのベースURL
const API_BASE_URL = 'https://bizknot-app-backend.onrender.com';

// Firebase SDK の設定情報
const firebaseConfig = {
    apiKey: "AIzaSyDGYmSxCNuf5bpZfQe5e-T0bvUXkU6zXfg",
    authDomain: "bizknot-asever.firebaseapp.com",
    projectId: "bizknot-asever",
    storageBucket: "bizknot-asever.appspot.com",
    messagingSenderId: "103308146429",
    appId: "1:103308146429:web:474099dc997f0dc85b3094"
};


// --- Firebase SDK の初期化 ---
// 重複初期化を防ぐ
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}


// --- 共通ユーティリティ ---
// ログインが必要なページのための認証チェック
function protectPage(callback) {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // ログイン済みであれば、渡されたコールバック関数を実行
            callback(user);
        } else {
            // 未ログインであれば、ログインページへリダイレクト
            // ルートパス以外のページで未ログイン状態ならリダイレクトする
            const currentPath = window.location.pathname;
            if (currentPath !== '/' && currentPath !== '/index.html') {
                window.location.href = '/';
            }
        }
    });
}
