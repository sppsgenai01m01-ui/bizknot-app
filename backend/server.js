const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const vision = require('@google-cloud/vision');

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

// Increase the limit for JSON bodies to handle base64 images
app.use(express.json({ limit: '50mb' }));

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

app.post('/api/cards', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const cardData = req.body;

    const newCard = {
      ...cardData,
      userId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('business_cards').add(newCard);
    res.status(201).send({ id: docRef.id, message: 'Card created successfully' });

  } catch (error) {
    console.error('Error creating card:', error); // サーバー側のログに詳細を出力
    res.status(500).send(`Error creating card: ${error.message}`);
  }
});

// --- OCR API Endpoint ---
app.post('/api/ocr', verifyToken, async (req, res) => {
  try {
    const image = req.body.image;
    if (!image) {
      return res.status(400).send('No image provided');
    }

    // Creates a client
    const client = new vision.ImageAnnotatorClient();

    // Prepare the request
    const request = {
      image: {
        content: image,
      },
      features: [{ type: 'TEXT_DETECTION' }],
    };

    // Performs text detection on the image file
    const [result] = await client.textDetection(request);
    const detections = result.textAnnotations;
    
    if (detections && detections.length > 0) {
      // The first element in textAnnotations is the full detected text
      const extractedText = detections[0].description;
      res.status(200).send({ text: extractedText });
    } else {
      res.status(200).send({ text: '' }); // No text found
    }
  } catch (error) {
    console.error('Error during OCR processing:', error);
    res.status(500).send(`Error during OCR processing: ${error.message}`);
  }
});


// --- サーバーの起動 ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
