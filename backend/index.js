const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; // Renderが要求するポート

// CORS設定
app.use(cors()); 

// JSONリクエストボディをパースするためのミドルウェア
app.use(express.json());

// ルートエンドポイント
app.get('/', (req, res) => {
  res.send('BizKnot Backend Server is running!');
});

// OCR処理のエンドポイント（プレースホルダー）
app.post('/api/ocr', (req, res) => {
  console.log("Received OCR request");
  // ここに後ほどVision APIの処理を実装します
  res.json({ message: "OCR processing endpoint reached." });
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
