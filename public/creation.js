// app.jsでFirebase SDKは初期化済みのため、ここでは変数定義のみ行う
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

if (fileSelectButton) {
    fileSelectButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 親要素のクリックイベントと重複させない
        fileInput.click();
    });
}
const mobileFileSelectButton = document.getElementById('mobile-file-select-button');
if (mobileFileSelectButton) {
    mobileFileSelectButton.addEventListener('click', () => fileInput.click());
}

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
    
    // エリア全体をクリックしてもファイル選択を開く
    dropZone.addEventListener('click', (e) => {
        fileInput.click();
    });
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
        // 縦書き（jpn_vert）と横書き（jpn）を両方サポート
        const worker = await Tesseract.createWorker('jpn+jpn_vert');

        const ret = await worker.recognize(file);
        const extractedText = ret.data.text;
        await worker.terminate();
        console.log("OCR解析完了");

        // --- 2. 抽出テキストからの高度なパース（ゆらぎ・1行複数項目対応） ---
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

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(0\d{1,4}[-ー\s~]?\d{1,4}[-ー\s~]?\d{3,4})/g;
        const zipRegex = /[〒T\+]\s?\d{3}[-ー]?\d{4}/i;

        // 全文からメールアドレスを抽出（最初のものを採用）
        const allText = extractedText.replace(/[\s　]/g, '');
        const emailMatches = allText.match(emailRegex);
        if (emailMatches && emailMatches.length > 0) {
            parsedData.email = emailMatches[0];
        }

        // 行ごとに処理しながら、電話番号・住所・役職・会社名を抽出
        const usedLines = new Set();
        const phones = [];

        lines.forEach((line, i) => {
            const cleanLine = line.replace(/[\s　]/g, '');
            if (cleanLine.length === 0) return;

            // 電話番号の抽出 (複数/行またぎ対応)
            let match;
            while ((match = phoneRegex.exec(cleanLine)) !== null) {
                // 直前の行と現在の行を連結してコンテキスト（ラベル）を判定
                const context = ((i > 0 ? lines[i-1] : '') + line).toLowerCase();
                const number = match[1].replace(/[-ー\s~]/g, '-');
                phones.push({ number, context, lineIndex: i });
                // 電話番号が含まれる行は名前や会社名ではない可能性が高い
                usedLines.add(i);
            }

            // 住所の抽出
            if (!parsedData.address && (zipRegex.test(cleanLine) || cleanLine.match(/(都|道|府|県|市区町村)/))) {
                parsedData.address = cleanLine.replace(/^(?:.*住所[:：])?(?:.*〒)?([0-9]{3}[-ー][0-9]{4})?/, '〒$1 ');
                if(!parsedData.address.includes('〒')) {
                    parsedData.address = cleanLine.replace(/^.*(?:住所[:：])?/, '');
                }
                usedLines.add(i);
            }

            // 役職・部署の抽出
            if (cleanLine.match(/(部|課|室|代表|社長|取締役|マネージャー|チーフ|担当|CEO|CTO|CFO|店長|主任|営業|Office|オフィス)/i) && cleanLine.length < 30) {
                if (!parsedData.position) {
                    parsedData.position = line;
                    usedLines.add(i);
                } else if (!parsedData.department) {
                    parsedData.department = parsedData.position;
                    parsedData.position = line;
                    usedLines.add(i);
                }
            }

            // 会社名の抽出 (キーワード拡充)
            if (!parsedData.companyName && cleanLine.match(/(?:株式|有限|合同|Inc|Corp|Office|オフィス|事務所|クリニック|店|屋)/i)) {
                // 英語や各種法人格を含む行全体を採用（余計なラベルは外す可能性あり）
                parsedData.companyName = line;
                usedLines.add(i);
            }
            
            // URLが含まれる場合は除外しておく
            if (cleanLine.match(/http/i) || cleanLine.match(/www\./i) || cleanLine.match(/\.com|\.co\.jp|\.net/i)) {
                usedLines.add(i);
            }
        });

        // 抽出した電話番号を種別ごとに割り当て
        phones.forEach(p => {
            if (p.context.match(/fax/i)) {
                if (!parsedData.fax) parsedData.fax = p.number;
            } else if (p.context.match(/(携帯|mobile|cell)/i) || p.number.startsWith('090') || p.number.startsWith('080') || p.number.startsWith('070')) {
                if (!parsedData.mobilePhone) parsedData.mobilePhone = p.number;
            } else {
                if (!parsedData.companyPhone) parsedData.companyPhone = p.number;
            }
        });

        // 氏名の抽出 (残った行から推測)
        lines.forEach((line, i) => {
            if (usedLines.has(i) || parsedData.name) return;
            const cleanLine = line.replace(/[\s　]/g, '');
            // 数字やEメール特有の記号を含まない、2〜20文字
            if (!cleanLine.match(/[0-9@,.:]/) && cleanLine.length >= 2 && cleanLine.length <= 20) {
                // 余計な役職テキストなどが混入していれば除去
                let nameCandidate = line.replace(/(代表取締役|社長|役員|執行役員|本部長|事業部長|部長|次長|課長|係長|主任|店長|営業)/g, '').trim();
                // 英語表記（ローマ字）が混ざっている場合、日本語部分のみを優先するかそのまま使う
                if (nameCandidate.length >= 2) {
                    parsedData.name = nameCandidate;
                    usedLines.add(i);
                }
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