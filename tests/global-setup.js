const admin = require('firebase-admin');
const users = require('./fixtures/users.json');

// Firebase Admin SDK の初期化（エミュレータを向かせる）
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-bizknot-test' // テスト用のダミーProjectID
  });
}

async function globalSetup() {
  const auth = admin.auth();
  const db = admin.firestore();

  console.log('--- Global Setup: Initializing Emulator Data ---');

  for (const user of users) {
    try {
      // 1. Authエミュレータにユーザーを作成
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: true
      });
      console.log(`Created Auth user: ${user.email}`);
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        console.log(`Auth user already exists: ${user.email}`);
      } else {
        console.error('Error creating auth user:', error);
      }
    }

    // 2. Firestoreエミュレータの users コレクションに権限とステータスを登録
    // ※BizKnotのアーキテクチャでは、カスタムクレームではなくFirestoreで権限管理を行う
    await db.collection('users').doc(user.uid).set({
      email: user.email,
      displayName: user.displayName,
      permission: user.permission,
      status: user.status,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`Initialized Firestore user document for: ${user.email} (Role: ${user.permission}, Status: ${user.status})`);
  }
  
  console.log('--- Global Setup Complete ---');
}

module.exports = globalSetup;
