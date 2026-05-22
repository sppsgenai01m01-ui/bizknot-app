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
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4">
                    <div class="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                        <h3 class="text-xl font-bold text-gray-800">更新履歴</h3>
                        <button id="close-history-modal" class="text-gray-500 hover:text-red-500 bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-4 overflow-y-auto flex-1 bg-gray-100" id="history-content">
                        <div class="flex justify-center my-8"><div class="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-500"></div></div>
                    </div>
                    <div class="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                        <button id="close-history-modal-btn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded shadow">閉じる</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const closeModal = () => modal.classList.add('hidden');
            document.getElementById('close-history-modal').addEventListener('click', closeModal);
            document.getElementById('close-history-modal-btn').addEventListener('click', closeModal);
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
        // --- 1. 画像の事前最適化（抜本的精度向上のための重要処理） ---
        // スマホの巨大な画像や回転(EXIF)を修正するため、先にCanvasで圧縮・補正を行う
        console.log("画像の事前最適化を実行します...");
        const compressedBase64 = await compressImage(file);

        // --- 2. Tesseract.js による OCR 解析 (完全無料・ブラウザ完結) ---
        console.log("OCR解析を開始します...");
        const worker = await Tesseract.createWorker('jpn+jpn_vert');
        // 生のfileではなく、回転補正・リサイズ済みの画像を渡すことで精度と速度が劇的に向上する
        const ret = await worker.recognize(compressedBase64);
        const extractedText = ret.data.text;
        await worker.terminate();
        console.log("OCR解析完了");

        // --- 3. 抽出テキストからの高度なパース ---
        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let parsedData = {
            companyName: "", name: "", email: "", companyPhone: "", mobilePhone: "", fax: "", department: "", position: "", address: "", memo: ""
        };

        const phoneRegex = /(0\d{1,4}[-ー\s~]?\d{1,4}[-ー\s~]?\d{3,4})/g;
        const zipRegex = /[〒T\+]\s?\d{3}[-ー]?\d{4}/i;

        const usedLines = new Set();
        const phones = [];

        // Eメールは各行ごとに判定（ゴミデータに巻き込まれないようにする）
        lines.forEach((line, i) => {
            const cleanLine = line.replace(/[\s　]/g, '');
            if (!parsedData.email) {
                // Eメール抽出の正規表現をやや緩めに設定（OCRの誤認識 e-rnail などにも強くするため、@の前後で判定）
                const emailMatch = cleanLine.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                    parsedData.email = emailMatch[0];
                    usedLines.add(i);
                }
            }
        });

        lines.forEach((line, i) => {
            if (usedLines.has(i)) return;
            const cleanLine = line.replace(/[\s　]/g, '');
            if (cleanLine.length === 0) return;

            // 電話番号の抽出 (複数/行またぎ対応)
            let match;
            while ((match = phoneRegex.exec(cleanLine)) !== null) {
                // 番号の直前15文字を取得して判定（同じ行にTELとFAXがあっても区別できるようにする抜本的修正）
                const prefix = cleanLine.substring(Math.max(0, match.index - 15), match.index).toLowerCase();
                const context = ((i > 0 ? lines[i-1] : '') + prefix).toLowerCase();
                const number = match[1].replace(/[-ー\s~]/g, '-');
                phones.push({ number, context, lineIndex: i });
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

            // 役職・部署の抽出 (店・屋は会社名候補と被るため削除)
            if (cleanLine.match(/(部|課|室|代表|社長|取締役|マネージャー|チーフ|担当|CEO|CTO|CFO|主任|営業|マネジメント)/i) && cleanLine.length < 30) {
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
            if (!parsedData.companyName && cleanLine.match(/(?:株式|有限|合同|Inc|Corp|Office|オフィス|事務所|クリニック|財団|社団|組合)/i)) {
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

        // --- 4. 残った行から会社名と氏名を強力に推測（フォールバック） ---
        const remainingLines = [];
        lines.forEach((line, i) => {
            if (!usedLines.has(i)) {
                const cleanLine = line.replace(/[\s　]/g, '');
                // 記号だらけの文字化け（| ~ _ - .）や極端に短い行はノイズとして完全に無視する
                if (cleanLine.length >= 2 && !cleanLine.match(/^[|~_.-]+$/) && !cleanLine.match(/[|]/)) {
                    remainingLines.push({ text: line, clean: cleanLine, index: i });
                }
            }
        });

        remainingLines.forEach(item => {
            // キーワードで見つからなかった場合、最初の有効な行を会社名とみなす（名刺ダイレクト対策）
            if (!parsedData.companyName && item.clean.length >= 2) {
                parsedData.companyName = item.text;
                usedLines.add(item.index);
            }
            // 会社名が既にあり、氏名がまだなく、数字や特殊記号を含まない行を氏名とみなす
            else if (!parsedData.name && !item.clean.match(/[0-9@,.:_]/)) {
                let nameCandidate = item.text.replace(/(代表取締役|社長|役員|執行役員|本部長|事業部長|部長|次長|課長|係長|主任|店長|営業)/g, '').trim();
                if (nameCandidate.length >= 2) {
                    parsedData.name = nameCandidate;
                    usedLines.add(item.index);
                }
            }
        });

        parsedData.memo = ""; // ゴミデータ強制入力を廃止

        // --- 5. フォームへの引き継ぎ（一時保存） ---
        
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