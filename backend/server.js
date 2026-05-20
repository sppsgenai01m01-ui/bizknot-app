const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// --- サーバーのセットアップ ---
const app = express();
app.use(cors({ origin: true })); // Firebase Hostingからのリクエストを許可
app.use(express.json());

// --- Firebase Admin SDKの初期化 ---
// 【重要】このコードを実行する環境で、サービスアカウントのキーファイルへのパスを
// GOOGLE_APPLICATION_CREDENTIALS 環境変数に設定するか、以下の様に直接読み込みます。
// Renderにデプロイする際は、Renderの「Secret File」機能を使ってキーファイルを安全にアップロードします。
const serviceAccount = require('./serviceAccountKey.json'); // ← あなたが生成したキーファイル名に要変更
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- IDトークンを検証するミドルウェア ---
asyn_c function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized: No token provided');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // デコードされたユーザー情報をリクエストに添付
    next();
  } catch (error) { 
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized: Invalid token');
  }
}


// --- APIエンドポイントの定義 ---

// 【テスト用】サーバーが起動しているか確認
app.get('/api/hello', (req, res) => {
  res.status(200).send('Hello from BizKnot Backend!');
});

// 【新規】名刺情報を作成するエンドポイント
app.post('/api/cards', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid; // ミドルウェアで検証済みのユーザーUIDを取得
    const cardData = req.body;

    // サーバー側でuserIdを付与し、セキュリティを担保
    const newCard = {
      ...cardData,
      userId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('business_cards').add(newCard);
    res.status(201).send({ id: docRef.id, message: 'Card created successfully' });

  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).send('Error creating card');
  }
});


// --- サーバーの起動 ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});