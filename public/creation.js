
// Firebase SDK の初期化
const firebaseConfig = {
    apiKey: "AIzaSyDGYmSxCNuf5bpZfQe5e-T0bvUXkU6zXfg",
    authDomain: "bizknot-asever.firebaseapp.com",
    projectId: "bizknot-asever",
    storageBucket: "bizknot-asever.firebasestorage.app",
    messagingSenderId: "103308146429",
    appId: "1:103308146429:web:474099dc997f0dc85b3094"
};

firebase.initializeApp(firebaseConfig);
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

let currentUser;

// 認証状態の監視
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // デバイスに応じてUIを初期化
        initUI();
    } else {
        window.location.href = '/';
    }
});

// UIの初期化
function initUI() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        // モバイル：カメラをセットアップ
        dropZone.classList.add('hidden');
        cameraView.classList.remove('hidden');
        setupCamera();
    } else {
        // PC：ドラッグ＆ドロップをセットアップ
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

// アップロードと画面遷移 (バックエンド呼び出しを削除したバージョン)
async function uploadAndProceed(file) {
    loadingOverlay.classList.remove('hidden');

    try {
        // 1. Firestoreで新しいドキュメントIDを生成
        const newCardRef = db.collection('businessCards').doc();
        const cardId = newCardRef.id;

        // 2. Cloud Storageに画像をアップロード
        const filePath = `uploads/${currentUser.uid}/${cardId}/${file.name}`;
        const storageRef = storage.ref(filePath);
        await storageRef.put(file);
        const imageUrl = await storageRef.getDownloadURL();

        // 3. Firestoreに、手動入力用の初期データを保存
        await newCardRef.set({
            ownerId: currentUser.uid,
            imageUrl: imageUrl, // アップロードした画像のURL
            companyName: "", // 以下、手動で入力する項目
            department: "",
            position: "",
            name: "",
            email: "",
            phone: "",
            address: "",
            website: "",
            memo: "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. 次の画面にIDを渡して遷移
        window.location.href = `/business_card_form.html?id=${cardId}`;

    } catch (error) {
        console.error("Upload failed:", error);
        alert("アップロードに失敗しました。もう一度お試しください。");
        loadingOverlay.classList.add('hidden');
    }
}
