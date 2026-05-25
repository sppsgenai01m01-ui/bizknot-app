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
                // OCR精度を担保するため最大サイズを1200pxに引き上げ（カラーでも容量はFirestore制限内）
                const maxSize = 1200;
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
                
                // 【重要】透過PNGなどがJPEG変換時に黒つぶれ（または異常な白黒化）するのを防ぐため、背景を白で塗りつぶす
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // EXIF回転や巨大画像のリサイズのみを行い、色はそのまま（カラー）維持する
                ctx.drawImage(img, 0, 0, width, height);

                // 画質80%でJPEG圧縮
                const base64Data = canvas.toDataURL('image/jpeg', 0.8);
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

        // --- 2. Tesseract.js による OCR 解析 ---
        console.log("OCR解析を開始します...");
        // 英語もロードしメール/URLの精度向上
        const worker = await Tesseract.createWorker('jpn+eng');
        // 名刺のようなブロック構造の文書には AUTO (3) もしくは SINGLE_BLOCK (6) が最適
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        });
        const ret = await worker.recognize(compressedBase64);
        const extractedText = ret.data.text;
        await worker.terminate();
        console.log("OCR解析完了");

        // --- レーベンシュタイン距離関数（ファジーマッチ用） ---
        const levenshtein = (a, b) => {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix = Array.from({length: b.length + 1}, (_, i) => [i]);
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
                    else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
            return matrix[b.length][a.length];
        };
        const commonPositions = ["代表取締役", "社長", "取締役", "執行役員", "本部長", "事業部長", "部長", "次長", "課長", "係長", "主任", "店長", "営業", "マネージャー"];

        // --- 3. 抽出テキストからの高度なパース ---
        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let parsedData = {
            companyName: "", name: "", email: "", companyPhone: "", mobilePhone: "", fax: "", department: "", position: "", address: "", memo: ""
        };

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        // まずはそのままのテキストから抽出（他の項目との結合バグを防ぐ）
        let emailMatches = extractedText.match(emailRegex);
        if (!emailMatches) {
            // 見つからなければ、スペースを除去して再度探す（ただし、前後の長すぎるノイズを避けるため文字数を制限）
            const allText = extractedText.replace(/[\s　]/g, '');
            emailMatches = allText.match(/[a-zA-Z0-9._%+-]{1,40}@[a-zA-Z0-9.-]{1,40}\.[a-zA-Z]{2,}/g);
        }
        
        if (emailMatches && emailMatches.length > 0) {
            // 万が一 "FAXemail@..." のように他の文字がくっついている場合は "FAX" や "TEL" "Email" などのプレフィックスを除去
            let cleanEmail = emailMatches[0].replace(/^(?:FAX|TEL|PHONE|MOBILE|EMAIL|E-MAIL|MAIL)[:：\s-]*/i, '');
            parsedData.email = cleanEmail;
        }

        const phoneRegex = /(0\d{1,4}[-ー\s~]?\d{1,4}[-ー\s~]?\d{3,4})/g;
        const zipRegex = /[〒T\+]\s?([0-9]{3})[-ー]?([0-9]{4})/i;

        const usedLines = new Set();
        const phones = [];

        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;
            let line = lines[i];
            const cleanLine = line.replace(/[\s　]/g, '');
            if (cleanLine.length === 0) continue;

            // 電話番号の抽出
            let match;
            let hasPhoneInLine = false;
            while ((match = phoneRegex.exec(cleanLine)) !== null) {
                hasPhoneInLine = true;
                const prefix = cleanLine.substring(Math.max(0, match.index - 15), match.index).toLowerCase();
                const context = ((i > 0 ? lines[i-1] : '') + prefix).toLowerCase();
                const number = match[1].replace(/[-ー\s~]/g, '-');
                phones.push({ number, context, lineIndex: i });
                
                // 役職にTEL等が混入しないよう、電話番号部分を元のlineから除去する
                line = line.replace(match[0], '');
            }
            if (hasPhoneInLine) {
                line = line.replace(/(TEL|FAX|Phone|Mobile|携帯|[:：\s])/gi, '').trim();
                if (line.length < 2) usedLines.add(i); // 番号以外何も残らなければ無視
            }

            // 住所の抽出とAPI補完
            const zMatch = line.match(zipRegex);
            if (!parsedData.address && (zMatch || cleanLine.match(/(都|道|府|県|市区町村)/))) {
                if (zMatch) {
                    const zipcode = zMatch[1] + zMatch[2];
                    try {
                        const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
                        const zipData = await res.json();
                        if (zipData.status === 200 && zipData.results) {
                            const result = zipData.results[0];
                            parsedData.address = `〒${zMatch[1]}-${zMatch[2]} ${result.address1}${result.address2}${result.address3}`;
                            // ビル名などを追加で探す
                            const restOfLine = line.replace(zMatch[0], '').trim();
                            if (restOfLine) parsedData.address += ' ' + restOfLine;
                            // 次の行も住所（番地・ビル名）である可能性が高い
                            if (i + 1 < lines.length && !lines[i+1].match(/[0-9@]/) && lines[i+1].length > 2) {
                                parsedData.address += ' ' + lines[i+1].trim();
                                usedLines.add(i+1);
                            }
                            usedLines.add(i);
                            continue;
                        }
                    } catch(e) { console.error("Zipcloud API error", e); }
                }
                // API失敗時または〒がない場合
                parsedData.address = line.replace(/^(?:.*住所[:：])?(?:.*〒)?([0-9]{3}[-ー][0-9]{4})?/, '〒$1 ');
                if(!parsedData.address.includes('〒')) {
                    parsedData.address = line.replace(/^.*(?:住所[:：])?/, '');
                }
                usedLines.add(i);
            }

            // 役職・部署の抽出 (クリーニングされたlineを使用)
            if (line.match(/(部|課|室|代表|社長|取締役|マネージャー|チーフ|担当|CEO|CTO|CFO|主任|営業|マネジメント)/i) && line.length < 30) {
                // レーベンシュタイン距離によるクリーニング
                let cleanedPosition = line.trim();
                for (const t of commonPositions) {
                    if (Math.abs(t.length - cleanedPosition.length) <= 2) {
                        if (levenshtein(t, cleanedPosition) <= 2) {
                            cleanedPosition = t;
                            break;
                        }
                    }
                }
                if (!parsedData.position) {
                    parsedData.position = cleanedPosition;
                    usedLines.add(i);
                } else if (!parsedData.department) {
                    parsedData.department = parsedData.position;
                    parsedData.position = cleanedPosition;
                    usedLines.add(i);
                }
            }

            // 会社名の抽出 (キーワード拡充)
            if (!parsedData.companyName && line.match(/(?:株式|有限|合同|Inc|Corp|Office|オフィス|事務所|クリニック|財団|社団|組合)/i)) {
                parsedData.companyName = line;
                usedLines.add(i);
            }
            
            // URLが含まれる場合は除外しておく
            if (line.match(/http/i) || line.match(/www\./i) || line.match(/\.com|\.co\.jp|\.net/i)) {
                usedLines.add(i);
            }
        }

        // 抽出した電話番号を種別ごとに割り当て
        phones.forEach(p => {
            if (p.context.match(/fax/i)) {
                if (!parsedData.fax) parsedData.fax = p.number;
            } else if (p.context.match(/(携帯|mobile|cell)/i) || p.number.startsWith('090') || p.number.startsWith('080') || p.number.startsWith('070')) {
                if (!parsedData.mobilePhone) parsedData.mobilePhone = p.number;
            } else {
                if (!parsedData.companyPhone) {
                    parsedData.companyPhone = p.number;
                } else if (!parsedData.fax) {
                    // 2つ目の固定電話番号は自動的にFAXとする（よくある名刺レイアウト対応）
                    parsedData.fax = p.number;
                }
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