// Firebase SDK の初期化
const firebaseConfig = {
    apiKey: "AIzaSyDGYmSxCNuf5bpZfQe5e-T0bvUXkU6zXfg",
    authDomain: "bizknot-asever.firebaseapp.com",
    projectId: "bizknot-asever",
    storageBucket: "bizknot-asever.firebasestorage.app",
    messagingSenderId: "103308146429",
    appId: "1:103308146429:web:474099dc997f0dc85b3094"
};

// 念のため二重初期化を防ぐ処理
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const storage = firebase.storage();
const db = firebase.firestore();

// DOM要素
const dropZone = document.getElementById('drop-zone');
const cameraView = document.getElementById('camera-view');
const fileSelectButton = document.getElementById('file-select-button');
const fileInput = document.getElementById('file-input');
const videoElement = document.getElementById('video-element');
const shutterButton = document.getElementById('shutter-button');
const loadingOverlay = document.getElementById('loading-overlay');
const selectFromAlbumLink = document.getElementById('select-from-album-link'); // ★追加

let currentUser;

// 認証状態の監視
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        initUI();
    } else {
        window.location.href = '/';
    }
});

// UIの初期化
function initUI() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        dropZone.classList.add('hidden');
        cameraView.classList.remove('hidden');
        setupCamera();
    } else {
        cameraView.classList.add('hidden');
        dropZone.classList.remove('hidden');
        setupDragAndDrop();
    }
}

// カメラのセットアップ
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoElement.srcObject = stream;
    } catch (err) {
        console.error("Camera Error:", err);
        alert("カメラの起動に失敗しました。ブラウザの権限を確認してください。");
    }
}

// ドラッグ＆ドロップのセットアップ
function setupDragAndDrop() {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-gray-50');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('bg-gray-50');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-gray-50');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    fileSelectButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

// シャッターボタンのイベント
shutterButton.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    canvas.getContext('2d').drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(handleFile, 'image/jpeg');
});

// ★追加: アルバムから選択リンクのイベント
selectFromAlbumLink.addEventListener('click', (e) => {
    e.preventDefault(); // リンクのデフォルト動作を防ぐ
    fileInput.click(); // ファイル選択ダイアログを開く
});

// ファイル処理とバリデーション
function handleFile(file) {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        alert('対応していないファイル形式です。JPEG, PNG, JPG形式の画像を選択してください。');
        return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        alert('ファイルサイズが5MBを超えています。');
        return;
    }

    uploadAndProceed(file);
}

// アップロードとOCR処理、画面遷移
async function uploadAndProceed(file) {
    loadingOverlay.classList.remove('hidden');

    try {
        // --- 1. Tesseract.js による OCR 解析 (完全無料・ブラウザ完結) ---
        console.log("OCR解析を開始します...");
        const worker = await Tesseract.createWorker('jpn');
        const ret = await worker.recognize(file);
        const extractedText = ret.data.text;
        await worker.terminate();
        console.log("OCR解析完了");

        // --- 2. 抽出テキストからの簡易パース（推測ロジック） ---
        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let parsedData = {
            companyName: "",
            name: "",
            email: "",
            phone: "",
            department: "",
            position: "",
            // 【重要】最強のフェイルセーフ：読み取った全文をメモに残す
            memo: "【OCR読み取りデータ】\n" + lines.join('\n')
        };

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const phoneRegex = /(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})/;

        lines.forEach(line => {
            // メールアドレス抽出
            if (!parsedData.email && emailRegex.test(line)) {
                parsedData.email = line.match(emailRegex)[0];
            }
            // 電話番号抽出
            else if (!parsedData.phone && phoneRegex.test(line)) {
                parsedData.phone = line.match(phoneRegex)[0];
            }
            // 会社名抽出 (簡易判定)
            else if (!parsedData.companyName && (line.includes('株式') || line.includes('有限') || line.includes('合同') || line.includes('Inc') || line.includes('Corp'))) {
                parsedData.companyName = line;
            }
        });

        // --- 3. Firestore と Storage への保存 ---
        const newCardRef = db.collection('businessCards').doc();
        const cardId = newCardRef.id;

        // 画像のアップロード
        const filePath = `uploads/${currentUser.uid}/${cardId}/${file.name}`;
        const storageRef = storage.ref(filePath);
        await storageRef.put(file);
        const imageUrl = await storageRef.getDownloadURL();

        // FirestoreにOCRの推測結果を含めて保存
        await newCardRef.set({
            ownerId: currentUser.uid,
            imageUrl: imageUrl,
            companyName: parsedData.companyName,
            department: parsedData.department,
            position: parsedData.position,
            name: parsedData.name, // 誤判定を防ぐため手動入力に委ねる
            email: parsedData.email,
            phone: parsedData.phone,
            address: "",
            website: "",
            memo: parsedData.memo, // 全文が入るため、次の画面でコピペしやすい
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. 次の画面（フォーム入力画面）にIDを渡して遷移
        window.location.href = `/business_card_form.html?id=${cardId}`;

    } catch (error) {
        console.error("Upload/OCR failed:", error);
        alert("画像の解析またはアップロードに失敗しました。もう一度お試しください。");
        loadingOverlay.classList.add('hidden');
    }
}
