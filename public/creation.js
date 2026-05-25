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

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        initUI();
    } else {
        window.location.href = '/';
    }
});

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

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

if (fileSelectButton) {
    fileSelectButton.addEventListener('click', (e) => {
        e.stopPropagation(); 
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
        if (files.length > 0) handleFile(files[0]);
    });
    dropZone.addEventListener('click', () => fileInput.click());
}

// ファイル処理とバリデーション（EXIF自動回転対応版）
async function handleFile(file) {
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

    loadingOverlay.classList.remove('hidden');

    try {
        const { processImage } = await import('./utils/imageProcessor.js');
        const processedFile = await processImage(file);
        
        if (!processedFile.name) {
            processedFile.name = file.name || `image_${Date.now()}.jpg`;
        }
        await uploadAndProceed(processedFile);
    } catch (error) {
        console.error("画像処理エラー:", error);
        if (!file.name) file.name = `image_${Date.now()}.jpg`;
        await uploadAndProceed(file);
    }
}

// 画像を圧縮してBase64文字列に変換する処理
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
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
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

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
    let isCompleted = false;
    const timeoutId = setTimeout(() => {
        if (!isCompleted) {
            console.warn("Processing timeout occurred.");
            alert("通信または画像解析に時間がかかりすぎたためタイムアウトしました。\n手動入力画面へ移動します。");
            window.location.href = '/business_card_form.html';
        }
    }, 30000);

    try {
        console.log("画像の事前最適化を実行します...");
        const compressedBase64 = await compressImage(file);

        console.log("OCR解析を開始します...");
        const worker = await Tesseract.createWorker('jpn+eng');
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        });
        const ret = await worker.recognize(compressedBase64);
        const extractedText = ret.data.text;
        await worker.terminate();
        console.log("OCR解析完了");

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

        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let parsedData = { companyName: "", name: "", email: "", companyPhone: "", mobilePhone: "", fax: "", department: "", position: "", address: "", memo: "" };

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        let emailMatches = extractedText.match(emailRegex);
        if (!emailMatches) {
            const allText = extractedText.replace(/[\s　]/g, '');
            emailMatches = allText.match(/[a-zA-Z0-9._%+-]{1,40}@[a-zA-Z0-9.-]{1,40}\.[a-zA-Z]{2,}/g);
        }
        if (emailMatches && emailMatches.length > 0) {
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

            let match;
            let hasPhoneInLine = false;
            while ((match = phoneRegex.exec(cleanLine)) !== null) {
                hasPhoneInLine = true;
                const prefix = cleanLine.substring(Math.max(0, match.index - 15), match.index).toLowerCase();
                const context = ((i > 0 ? lines[i-1] : '') + prefix).toLowerCase();
                const number = match[1].replace(/[-ー\s~]/g, '-');
                phones.push({ number, context, lineIndex: i });
                line = line.replace(match[0], '');
            }
            if (hasPhoneInLine) {
                line = line.replace(/(TEL|FAX|Phone|Mobile|携帯|[:：\s])/gi, '').trim();
                if (line.length < 2) usedLines.add(i);
            }

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
                            const restOfLine = line.replace(zMatch[0], '').trim();
                            if (restOfLine) parsedData.address += ' ' + restOfLine;
                            if (i + 1 < lines.length && !lines[i+1].match(/[0-9@]/) && lines[i+1].length > 2) {
                                parsedData.address += ' ' + lines[i+1].trim();
                                usedLines.add(i+1);
                            }
                            usedLines.add(i);
                            continue;
                        }
                    } catch(e) { console.error("Zipcloud API error", e); }
                }
                parsedData.address = line.replace(/^(?:.*住所[:：])?(?:.*〒)?([0-9]{3}[-ー][0-9]{4})?/, '〒$1 ');
                if(!parsedData.address.includes('〒')) {
                    parsedData.address = line.replace(/^.*(?:住所[:：])?/, '');
                }
                usedLines.add(i);
            }

            if (line.match(/(部|課|室|代表|社長|取締役|マネージャー|チーフ|担当|CEO|CTO|CFO|主任|営業|マネジメント)/i) && line.length < 30) {
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

            if (!parsedData.companyName && line.match(/(?:株式|有限|合同|Inc|Corp|Office|オフィス|事務所|クリニック|財団|社団|組合)/i)) {
                parsedData.companyName = line;
                usedLines.add(i);
            }
            if (line.match(/http/i) || line.match(/www\./i) || line.match(/\.com|\.co\.jp|\.net/i)) {
                usedLines.add(i);
            }
        }

        phones.forEach(p => {
            if (p.context.match(/fax/i)) {
                if (!parsedData.fax) parsedData.fax = p.number;
            } else if (p.context.match(/(携帯|mobile|cell)/i) || p.number.startsWith('090') || p.number.startsWith('080') || p.number.startsWith('070')) {
                if (!parsedData.mobilePhone) parsedData.mobilePhone = p.number;
            } else {
                if (!parsedData.companyPhone) {
                    parsedData.companyPhone = p.number;
                } else if (!parsedData.fax) {
                    parsedData.fax = p.number;
                }
            }
        });

        const remainingLines = [];
        lines.forEach((line, i) => {
            if (!usedLines.has(i)) {
                const cleanLine = line.replace(/[\s　]/g, '');
                if (cleanLine.length >= 2 && !cleanLine.match(/^[|~_.-]+$/) && !cleanLine.match(/[|]/)) {
                    remainingLines.push({ text: line, clean: cleanLine, index: i });
                }
            }
        });

        remainingLines.forEach(item => {
            if (!parsedData.companyName && item.clean.length >= 2) {
                parsedData.companyName = item.text;
                usedLines.add(item.index);
            }
            else if (!parsedData.name && !item.clean.match(/[0-9@,.:_]/)) {
                let nameCandidate = item.text.replace(/(代表取締役|社長|役員|執行役員|本部長|事業部長|部長|次長|課長|係長|主任|店長|営業)/g, '').trim();
                if (nameCandidate.length >= 2) {
                    parsedData.name = nameCandidate;
                    usedLines.add(item.index);
                }
            }
        });

        parsedData.memo = ""; 

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
        window.location.href = `/business_card_form.html`;

    } catch (error) {
        isCompleted = true;
        clearTimeout(timeoutId);
        console.error("Upload/OCR failed:", error);
        if (error.message && error.message.includes('CORS')) {
            alert("Firebase StorageのCORS設定が不足しているためアップロードできません。\nGCPコンソールからCORS設定を行ってください。\n\n手動入力画面へ移動します。");
            window.location.href = '/business_card_form.html';
        } else {
            alert("画像の解析またはアップロードに失敗しました。もう一度お試しください。");
            loadingOverlay.classList.add('hidden');
        }
    }
}