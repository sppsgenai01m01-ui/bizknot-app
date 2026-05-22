// --- Firebase SDK の初期化 ---
// このファイルは、すべてのページで最初に読み込まれ、Firebaseの初期化を一度だけ行います。

const firebaseConfig = {
    apiKey: "AIzaSyDGYmSxCNuf5bpZfQe5e-T0bvUXkU6zXfg",
    authDomain: "bizknot-asever.firebaseapp.com",
    projectId: "bizknot-asever",
    storageBucket: "bizknot-asever.appspot.com",
    messagingSenderId: "103308146429",
    appId: "1:103308146429:web:474099dc997f0dc85b3094"
};

// 重複初期化を防ぐ
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- 共通ユーティリティ ---
// ログインが必要なページのための認証チェック
function protectPage(callback) {
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            try {
                const userRef = firebase.firestore().collection('users').doc(user.uid);
                const userDoc = await userRef.get();
                if (!userDoc.exists) {
                    // 初回ログイン時にFirestoreへユーザー情報を登録
                    await userRef.set({
                        displayName: user.displayName || user.email.split('@')[0],
                        email: user.email,
                        permission: 'user', // デフォルトは一般ユーザー
                        status: 'ACTIVE', // ACTIVE または SUSPENDED
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    const data = userDoc.data();
                    if (data.status === 'SUSPENDED') {
                        alert('このアカウントは管理者によって利用停止されています。');
                        await firebase.auth().signOut();
                        window.location.href = '/';
                        return;
                    }
                }
            } catch (e) {
                console.error("ユーザー情報の検証に失敗しました:", e);
            }
            // ログイン済み＆有効であればコールバックを実行
            callback(user);
        } else {
            // 未ログインであればログインページへリダイレクト
            const currentPath = window.location.pathname;
            if (currentPath !== '/' && currentPath !== '/index.html') {
                window.location.href = '/';
            }
        }
    });
}

// 監査ログを記録する共通関数
window.addAuditLog = async function(action, details = {}) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
        await firebase.firestore().collection('auditLogs').add({
            userId: user.uid,
            userEmail: user.email,
            action: action,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("監査ログの記録に失敗しました:", e);
    }
};
