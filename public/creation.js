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
const cameraInput = document.getElementById('camera-input');
const fileInput = document.getElementById('file-input');
const loadingOverlay = document.getElementById('loading-overlay');

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
    } else {
        cameraView.classList.add('hidden');
        dropZone.classList.remove('hidden');
        setupDragAndDrop();
    }
}

// グローバルなイベントリスナーの登録（PC/スマホ共通）
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
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
}

// ネイティブカメラへの移行により独自のシャッター処理は廃止

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

// 【無課金対応】画像を圧縮してBase64文字列に変換する処理
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Firestoreの容量制限を避けるため最大サイズを800pxに制限
                const maxSize = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // 画質70%でJPEG圧縮しBase64出力（約100KB前後になる）
                const base64Data = canvas.toDataURL('image/jpeg', 0.7);
                resolve(base64Data);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// アップロードとOCR処理、画面遷移
async function uploadAndProceed(file) {
    loadingOverlay.classList.remove('hidden');

    let isCompleted = false;

    // 処理全体のタイムアウト（30秒）
    const timeoutId = setTimeout(() => {
        if (!isCompleted) {
            console.warn("Processing timeout occurred.");
            alert("通信または画像解析に時間がかかりすぎたためタイムアウトしました。\n手動入力画面へ移動します。");
            window.location.href = '/business_card_form.html';
        }
    }, 30000);

    try {
        // --- 1. Tesseract.js による OCR 解析 (完全無料・ブラウザ完結) ---
        console.log("OCR解析を開始します...");
        const worker = await Tesseract.createWorker('jpn');

        const ret = await worker.recognize(file);
        const extractedText = ret.data.text;
        await worker.terminate();
        console.log("OCR解析完了");

        // --- 2. 抽出テキストからの簡易パース（ゆらぎ許容ロジック） ---
        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let parsedData = {
            companyName: "",
            name: "",
            email: "",
            companyPhone: "",
            mobilePhone: "",
            fax: "",
            department: "",
            position: "",
            address: "",
            memo: ""
        };

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        // ゆらぎ対応: スペースが含まれたり、ハイフンが別の記号として認識された場合も許容
        const phoneRegex = /(0\d{1,4}[-ー\s~]?\d{1,4}[-ー\s~]?\d{3,4})/;
        const zipRegex = /[〒T\+]\s?\d{3}[-ー]?\d{4}/i;

        const unparsedLines = [];

        lines.forEach(line => {
            let matched = false;
            // 全角・半角スペースを除去したクリーンな行
            const cleanLine = line.replace(/[\s　]/g, '');

            // 1. メールアドレス
            if (!parsedData.email && emailRegex.test(cleanLine)) {
                parsedData.email = cleanLine.match(emailRegex)[0];
                matched = true;
            }
            // 2. 電話・FAX番号の細分化抽出
            else if (phoneRegex.test(cleanLine)) {
                const number = cleanLine.match(phoneRegex)[0].replace(/[-ー\s~]/g, '-');
                
                if (cleanLine.match(/fax/i)) {
                    if (!parsedData.fax) {
                        parsedData.fax = number;
                        matched = true;
                    }
                } else if (cleanLine.match(/(携帯|mobile|090|080|070)/i) || number.startsWith('090') || number.startsWith('080') || number.startsWith('070')) {
                    if (!parsedData.mobilePhone) {
                        parsedData.mobilePhone = number;
                        matched = true;
                    }
                } else {
                    if (!parsedData.companyPhone) {
                        parsedData.companyPhone = number;
                        matched = true;
                    }
                }
            }
            // 3. 会社名 (ゴミ文字パージと、スペースが入った「株 式 会 社」対応)
            else if (!parsedData.companyName && cleanLine.match(/(?:株式|有限|合同|Inc|Corp)/i)) {
                // 株式会社以降の文字列を抽出
                const match = cleanLine.match(/(?:株式会社|有限会社|合同会社).+/);
                parsedData.companyName = match ? match[0] : cleanLine;
                matched = true;
            }
            // 4. 住所 (〒の誤読や都道府県に対応)
            else if (!parsedData.address && (zipRegex.test(cleanLine) || cleanLine.match(/(都|道|府|県|市区町村)/))) {
                parsedData.address = cleanLine.replace(/^(?:.*住所[:：])?(?:.*〒)?([0-9]{3}[-ー][0-9]{4})?/, '〒$1 ');
                if(!parsedData.address.includes('〒')) {
                    parsedData.address = cleanLine.replace(/^.*(?:住所[:：])?/, '');
                }
                matched = true;
            }
            // 5. 役職・部署 (複数のキーワードでゆらぎ対応)
            else if (!parsedData.department && !parsedData.position && cleanLine.match(/(部|課|室|代表|社長|取締役|マネージャー|チーフ|担当|CEO|CTO|CFO)/i)) {
                parsedData.position = line;
                matched = true;
            }
            // 6. 氏名 (数字・記号が含まれない、2〜20文字程度の文字列)
            else if (!parsedData.name && !cleanLine.match(/[0-9@,.:]/) && cleanLine.length >= 2 && cleanLine.length <= 20) {
                let nameCandidate = line.replace(/(代表取締役|社長|役員|執行役員|本部長|事業部長|部長|次長|課長|係長|主任)/g, '').trim();
                if (nameCandidate.length >= 2) {
                    parsedData.name = nameCandidate;
                    matched = true;
                }
            }

            if (!matched) {
                unparsedLines.push(line);
            }
        });

        // 意味不明なゴミデータが入るため、未分類OCRデータのメモへの強制入力を廃止
        parsedData.memo = "";

        // --- 3. フォームへの引き継ぎ（一時保存） ---
        // 代替処理: Canvasで圧縮してBase64文字列に変換
        const compressedBase64 = await compressImage(file);
        
        // 即時登録を廃止し、SessionStorageに一時保存してフォーム画面へ引き継ぐ
        const draftData = {
            imageUrl: compressedBase64,
            companyName: parsedData.companyName,
            department: parsedData.department,
            position: parsedData.position,
            name: parsedData.name, 
            email: parsedData.email,
            companyPhone: parsedData.companyPhone,
            mobilePhone: parsedData.mobilePhone,
            fax: parsedData.fax,
            address: parsedData.address,
            memo: parsedData.memo
        };

        sessionStorage.setItem('ocrDraft', JSON.stringify(draftData));

        isCompleted = true;
        clearTimeout(timeoutId);

        // 4. フォーム入力画面へ遷移（IDなし＝新規登録モード）
        window.location.href = `/business_card_form.html`;

    } catch (error) {
        isCompleted = true;
        clearTimeout(timeoutId);
        console.error("Upload/OCR failed:", error);
        
        // CORSエラーなどアップロード周りのエラーを分かりやすく通知
        if (error.message && error.message.includes('CORS')) {
            alert("Firebase StorageのCORS設定が不足しているためアップロードできません。\nGCPコンソールからCORS設定を行ってください。\n\n手動入力画面へ移動します。");
            window.location.href = '/business_card_form.html';
        } else {
            alert("画像の解析またはアップロードに失敗しました。もう一度お試しください。");
            loadingOverlay.classList.add('hidden');
        }
    }
}