document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase script has not been loaded.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    const cardForm = document.getElementById('card-form');
    const messageArea = document.getElementById('message-area');
    const submitButton = document.getElementById('submit-button');
    const ocrButton = document.getElementById('ocr-button');
    const cardImage = document.getElementById('card-image');
    const ocrStatus = document.getElementById('ocr-status');

    let currentUser = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
        } else {
            console.log('User is not logged in. Redirecting to login page.');
            window.location.href = 'index.html';
        }
    });

    if (ocrButton) {
        ocrButton.addEventListener('click', async () => {
            if (!cardImage.files || cardImage.files.length === 0) {
                alert('名刺画像を選択してください。');
                return;
            }

            if (!currentUser) {
                alert('ログインしていません。ログインしてください。');
                return;
            }

            const file = cardImage.files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                const base64Image = e.target.result.split(',')[1];
                ocrStatus.style.display = 'block';
                ocrButton.disabled = true;

                try {
                    const idToken = await currentUser.getIdToken(true);
                    const backendUrl = `${API_BASE_URL}/api/ocr`;

                    const response = await fetch(backendUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + idToken
                        },
                        body: JSON.stringify({ image: base64Image })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`OCR処理に失敗しました: ${errorText}`);
                    }

                    const result = await response.json();
                    if (result.text) {
                        parseOcrText(result.text);
                        messageArea.textContent = 'OCRによる情報の読み取りが完了しました。';
                        messageArea.className = 'message-success';
                    } else {
                        messageArea.textContent = '画像からテキストを抽出できませんでした。';
                        messageArea.className = 'message-info';
                    }
                } catch (error) {
                    console.error('Error during OCR processing:', error);
                    messageArea.textContent = `エラーが発生しました: ${error.message}`;
                    messageArea.className = 'message-error';
                } finally {
                    ocrStatus.style.display = 'none';
                    ocrButton.disabled = false;
                }
            };

            reader.readAsDataURL(file);
        });
    }
    
    function parseOcrText(text) {
    const lines = text.split('\n');
    let email = '';
    let phone = '';
    let company = '';
    let name = '';
    let department = '';
    let title = '';
    let address = '';

    lines.forEach(line => {
        line = line.trim();
        if (line.includes('@')) {
            email = line;
        } else if (line.match(/(\d{2,4}-){2}\d{4}/)) {
            phone = line;
        } else if (line.includes('株式会社') || line.includes('合同会社')) {
            company = line;
        } else if (line.includes('部') || line.includes('課')) {
             department = line;
        } else if (line.match(/^[\u4E00-\u9FAF\s]+$/) && !company && !department && !title) {
            // Assumption: name is likely to be mostly Japanese characters
            if(!name) name = line; // prioritize first likely name
        } else if (line.includes('〒') || line.includes('東京都') || line.includes('県')|| line.includes('府') || line.includes('市')) {
            address += line + ' ';
        }
    });

    if (company) document.getElementById('company').value = company;
    if (name) document.getElementById('name').value = name;
    if (email) document.getElementById('email').value = email;
    if (phone) document.getElementById('tel').value = phone;
    if (department) document.getElementById('department').value = department;
    if (address) document.getElementById('address').value = address.trim();
    
    // Simple title extraction might be tricky, looking for common patterns
    const titles = ['代表取締役', '取締役', 'マネージャー', '部長', '課長'];
    titles.forEach(t => {
        if (text.includes(t)) {
            title = t;
            document.getElementById('title').value = title;
        }
    });
}


    if (cardForm) {
        cardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitButton.disabled = true;
            messageArea.textContent = '登録処理中...';
            messageArea.className = 'message-info';

            if (!currentUser) {
                messageArea.textContent = 'エラー: ログインしていません。';
                messageArea.className = 'message-error';
                submitButton.disabled = false;
                return;
            }

            const company = document.getElementById('company').value.trim();
            const name = document.getElementById('name').value.trim();

            if (!company || !name) {
                messageArea.textContent = 'エラー: 「会社名・組織名」と「氏名」は必須項目です。';
                messageArea.className = 'message-error';
                submitButton.disabled = false;
                return;
            }

            try {
                const idToken = await currentUser.getIdToken(true);
                const cardData = {
                    company: company,
                    department: document.getElementById('department').value.trim(),
                    title: document.getElementById('title').value.trim(),
                    name: name,
                    email: document.getElementById('email').value.trim(),
                    tel: document.getElementById('tel').value.trim(),
                    address: document.getElementById('address').value.trim(),
                    notes: document.getElementById('notes').value.trim(),
                };

                const backendUrl = `${API_BASE_URL}/api/cards`;

                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + idToken
                    },
                    body: JSON.stringify(cardData)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`サーバーからの応答が不正です: ${errorText}`);
                }

                messageArea.textContent = '名刺の登録に成功しました！一覧ページに移動します。';
                messageArea.className = 'message-success';

                setTimeout(() => {
                    window.location.href = 'business_card_list.html';
                }, 2000);

            } catch (error) {
                console.error('Error adding document via backend: ', error);
                messageArea.textContent = `エラーが発生しました: ${error.message}`;
                messageArea.className = 'message-error';
                submitButton.disabled = false;
            }
        });
    }
});
