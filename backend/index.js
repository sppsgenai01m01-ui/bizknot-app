const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CORS, JSONパーサー設定 ---
app.use(cors());
app.use(express.json());

// --- Multer設定 (画像アップロード処理) ---
// 画像をメモリ上に保存する設定
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Vision API クライアントの初期化 ---
let visionClient;
try {
  // Renderの環境変数からサービスアカウント情報を読み込む
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsJson) {
    console.log('GOOGLE_CREDENTIALS_JSON is not set. OCR API will be disabled.');
  } else {
    const credentials = JSON.parse(credentialsJson);
    visionClient = new ImageAnnotatorClient({ credentials });
    console.log('Vision API client initialized successfully.');
  }
} catch (error) {
  console.error('Failed to initialize Vision API client:', error);
}

// --- APIエンドポイント ---

app.get('/', (req, res) => {
  res.send('BizKnot Backend Server is running!');
});

/**
 * OCR処理エンドポイント
 * multipart/form-data で "image" というキーの画像ファイルを受け取る
 */
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  if (!visionClient) {
    return res.status(503).json({ error: 'OCR service is not available. Check server configuration.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  try {
    console.log('Received image for OCR. Processing with Vision API...');
    const [result] = await visionClient.textDetection(req.file.buffer);
    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
        return res.status(404).json({ error: 'No text found in the image.' });
    }

    // 抽出したテキスト全体を1つのブロックとして結合
    const fullText = detections[0].description;
    
    // ここで単純なキーワードベースの抽出ロジックを実装
    // TODO: より高度な解析ロジックへの改善
    const parsedData = parseVCard(fullText);

    console.log('Successfully parsed data:', parsedData);
    res.json(parsedData);

  } catch (error) {
    console.error('Error during Vision API processing:', error);
    res.status(500).json({ error: 'Failed to process image with Vision API.' });
  }
});

// --- テキスト解析ヘルパー関数 ---

/**
 * 抽出したテキスト全体からキーワードを元に情報を抜き出す
 * @param {string} text Vision APIが返したテキスト全体
 * @returns {object} 整形された名刺データ
 */
function parseVCard(text) {
    const lines = text.split('\n');
    const data = {
        company: '',
        name: '',
        department: '',
        position: '',
        zipCode: '',
        address: '',
        tel: '',
        fax: '',
        email: '',
        website: ''
    };

    // 正規表現の定義
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const telRegex = /(?:TEL|電話)[:.\s]*([0-9-]{10,13})/i;
    const faxRegex = /(?:FAX)[:.\s]*([0-9-]{10,13})/i;
    const zipRegex = /〒?([0-9]{3}-?[0-9]{4})/;
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

    // 会社名によくあるキーワード
    const companyKeywords = ['株式会社', '有限会社', '合同会社', 'Co.', 'Ltd.', 'Inc.'];

    lines.forEach(line => {
        // 簡単な割り当てロジック
        if (!data.email && emailRegex.test(line)) {
            data.email = line.match(emailRegex)[0];
        }
        if (!data.tel && telRegex.test(line)) {
            data.tel = line.match(telRegex)[1];
        }
        if (!data.fax && faxRegex.test(line)) {
            data.fax = line.match(faxRegex)[1];
        }
        if (!data.zipCode && zipRegex.test(line)) {
            data.zipCode = line.match(zipRegex)[1];
        }
        if (!data.website && urlRegex.test(line) && !line.includes('@')) {
            data.website = line.match(urlRegex)[0];
        }
        if (!data.company && companyKeywords.some(kw => line.includes(kw))) {
            data.company = line.trim();
        }
    });

    return data;
}


// --- サーバー起動 ---
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
