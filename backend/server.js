const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// --- サーバーのセットアップ ---
const app = express();

// --- CORS設定 ---
// フロントエンドのURLを許可する
const allowedOrigins = ['https://bizknot-app-frontend.onrender.com'];
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Firebase Admin SDKの初期化 ---
let serviceAccount;

// 【重要】Renderの環境変数からサービスアカウント情報を読み込む
if (process.env.SERVICE_ACCOUNT_KEY_JSON) {
  // 環境変数に設定されたJSON文字列をパースして使用
  serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);
} else {
  // ローカル開発環境用：ファイルから読み込む
  // この方法は、ローカルでのテスト時にのみ使用されます。
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (error) {
    console.error('ローカルのサービスアカウントキーファイル(serviceAccountKey.json)が見つかりませんでした。');
    console.error('Render環境で実行する場合は、SERVICE_ACCOUNT_KEY_JSON 環境変数を設定してください。');
    process.exit(1); // サーバーを異常終了させる
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- IDトークンを検証するミドルウェア ---
async function verifyToken(req, res, next) {
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
