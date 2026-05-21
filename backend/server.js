const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const app = express();

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, '../public')));

// --- CORSヘッダーの手動設定 --- 
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  next();
});

app.use(express.json());

// --- Firebase Admin SDKの初期化 ---
let serviceAccount;

if (process.env.SERVICE_ACCOUNT_KEY_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);
  } catch (e) {
    console.error('Failed to parse SERVICE_ACCOUNT_KEY_JSON:', e);
  }
} else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (error) {
    console.error('local service account key file not found');
    process.exit(1);
  }
}

if (serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch(e) {
        console.error('Failed to initialize Firebase Admin SDK:', e);
    }
} else {
    console.error('Service Account is not configured.');
}

const db = admin.firestore();

// --- ▼▼▼ ここから改修 ▼▼▼ ---

// --- 検索キーワードを生成するヘルパー関数 ---
/**
 * 文字列から部分一致検索用のキーワード配列を生成する。
 * @param {...string} texts - キーワードを生成したい文字列（可変長引数）。
 * @returns {string[]} 重複を除いたキーワードの配列。
 */
const generateSearchKeywords = (...texts) => {
  const keywordSet = new Set();
  const validTexts = texts.filter(text => typeof text === 'string' && text.length > 0);

  for (const text of validTexts) {
    const lowerText = text.toLowerCase(); // 検索は小文字に統一
    for (let i = 0; i < lowerText.length; i++) {
      for (let j = i + 1; j <= lowerText.length; j++) {
        keywordSet.add(lowerText.substring(i, j));
      }
    }
  }
  // 注: この方法はデータ量が多くなるとFirestoreのドキュメントサイズ上限(1MB)に
  // 達する可能性があるため、本格的な運用ではAlgolia等(プランA)を推奨します。
  return Array.from(keywordSet);
};


// --- IDトークンを検証するミドルウェア ---
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized: No token provided');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) { 
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized: Invalid token');
  }
}

// --- APIエンドポイントの定義 ---
app.get('/api/hello', (req, res) => {
  res.status(200).send('Hello from BizKnot Backend!');
});

// --- 名刺作成API --- 
app.post('/api/cards', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const cardData = req.body;

    // 検索キーワードを生成
    const searchKeywords = generateSearchKeywords(cardData.name, cardData.company);

    const newCard = {
      ...cardData,
      userId: uid,
      searchKeywords, // 生成したキーワードをドキュメントに追加
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('business_cards').add(newCard);
    res.status(201).send({ id: docRef.id, message: 'Card created successfully' });

  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).send(`Error creating card: ${error.message}`);
  }
});

// --- ▲▲▲ 改修ここまで ▲▲▲ ---


// --- サーバーの起動 ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
