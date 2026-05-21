/**
 * BizKnot アプリケーション
 * 名刺新規作成ページ (creation.html) 用スクリプト
 */

document.addEventListener('DOMContentLoaded', () => {
  const db = firebase.firestore();
  const auth = firebase.auth();

  const form = document.getElementById('creation-form');
  const loadingOverlay = document.getElementById('loading-overlay');

  // OCR関連のDOM要素
  const ocrSection = document.getElementById('ocr-section');
  const ocrFileInput = document.getElementById('ocr-file-input');
  const ocrButton = document.getElementById('ocr-button');
  const ocrSpinner = document.getElementById('ocr-spinner');

  // --- 認証状態の監視 ---
  auth.onAuthStateChanged(user => {
    if (user) {
      // ユーザーがログインしている場合
      console.log('User is logged in.');
      loadingOverlay.style.display = 'none'; 
    } else {
      // ユーザーがログインしていない場合
      console.log('User is not logged in. Redirecting to index.html');
      window.location.href = 'index.html';
    }
  });

  // --- フォーム送信処理 ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    loadingOverlay.style.display = 'flex';

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error("No user logged in.");
        alert("ログインしていません。ログインページにリダイレクトします。");
        window.location.href = 'index.html';
        return;
    }

    try {
      await db.collection('business_cards').add({
        userId: currentUser.uid,
        company: document.getElementById('company').value,
        department: document.getElementById('department').value,
        position: document.getElementById('position').value,
        name: document.getElementById('name').value,
        zipCode: document.getElementById('zip-code').value,
        address: document.getElementById('address').value,
        tel: document.getElementById('tel').value,
        fax: document.getElementById('fax').value,
        email: document.getElementById('email').value,
        website: document.getElementById('website').value,
        notes: document.getElementById('notes').value,
        isDeleted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      console.log('New business card added successfully.');
      window.location.href = 'list.html'; 
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('名刺の登録中にエラーが発生しました。');
      loadingOverlay.style.display = 'none';
    }
  });

  // --- OCR機能 ---
  if (ocrButton) {
    ocrButton.addEventListener('click', async () => {
      const file = ocrFileInput.files[0];
      if (!file) {
        alert('画像ファイルを選択してください。');
        return;
      }

      ocrSpinner.style.display = 'block';

      const formData = new FormData();
      formData.append('image', file);

      // TODO: URLを環境変数化する
      const backendUrl = 'https://bizknot-backend.onrender.com/api/ocr';

      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error ${response.status}`);
        }

        const data = await response.json();
        console.log('OCR successful:', data);
        populateForm(data);
        alert('名刺の情報をフォームに自動入力しました。');

      } catch (error) {
        console.error('OCR Error:', error);
        alert(`OCR処理中にエラーが発生しました: ${error.message}`);
      } finally {
        ocrSpinner.style.display = 'none';
      }
    });
  }

  /**
   * OCR結果をフォームに自動入力する
   * @param {object} data - バックエンドから返された解析済みデータ
   */
  function populateForm(data) {
    if (data.company) document.getElementById('company').value = data.company;
    if (data.department) document.getElementById('department').value = data.department;
    if (data.position) document.getElementById('position').value = data.position;
    if (data.name) document.getElementById('name').value = data.name;
    if (data.zipCode) document.getElementById('zip-code').value = data.zipCode;
    if (data.address) document.getElementById('address').value = data.address;
    if (data.tel) document.getElementById('tel').value = data.tel;
    if (data.fax) document.getElementById('fax').value = data.fax;
    if (data.email) document.getElementById('email').value = data.email;
    if (data.website) document.getElementById('website').value = data.website;
  }
});
