
// Firebase SDKの初期化
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
const db = firebase.firestore();

// DOM要素
const userNameDisplay = document.getElementById('user-name-display');
const cardListContainer = document.getElementById('card-list-container');
const loadMoreButton = document.getElementById('load-more-button');
const searchButton = document.getElementById('search-button');
const searchKeyword = document.getElementById('search-keyword');

let currentUser;
let lastVisibleDoc = null; // ページネーション用の最後のドキュメント
const CARDS_PER_PAGE = 20;

// 認証状態の監視
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        userNameDisplay.textContent = user.displayName || 'ゲスト';
        fetchCards(true); // 初期読み込み
    } else {
        window.location.href = '/';
    }
});

// 名刺データを取得する関数
async function fetchCards(isInitialLoad = false, keyword = '') {
    if (isInitialLoad) {
        cardListContainer.innerHTML = ''; // 初期化
        lastVisibleDoc = null;
    }

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = '読み込み中...';

    try {
        let query = db.collection('businessCards')
                      .orderBy('createdAt', 'desc')
                      .limit(CARDS_PER_PAGE);
        
        // ページネーション
        if (lastVisibleDoc) {
            query = query.startAfter(lastVisibleDoc);
        }

        // TODO: 検索キーワードでの絞り込み。Firestoreのクエリは単純な部分一致をサポートしないため、
        // より高度な検索にはAlgoliaなどの外部サービス連携が必要になる。
        // ここでは簡易的に何もしない。

        const snapshot = await query.get();

        if (snapshot.empty) {
            if(isInitialLoad) cardListContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">名刺はまだ登録されていません。</p>';
            loadMoreButton.classList.add('hidden'); // これ以上データはない
            return;
        }

        snapshot.forEach(doc => {
            const cardData = doc.data();
            const cardElement = createCardElement(doc.id, cardData);
            cardListContainer.appendChild(cardElement);
        });

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

        // 取得した件数が上限より少なければ、もう次はない
        if(snapshot.docs.length < CARDS_PER_PAGE){
             loadMoreButton.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error fetching cards: ", error);
        cardListContainer.innerHTML = '<p class="col-span-full text-center text-red-500">データの読み込みに失敗しました。</p>';
    } finally {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'もっと見る';
    }
}

// 名刺カードのHTML要素を作成
function createCardElement(id, data) {
    const cardLink = document.createElement('a');
    cardLink.href = `/business_card_detail.html?id=${id}`;
    cardLink.className = "block bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow duration-200";

    // サムネイル画像（ダミー）
    const thumbnail = data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.companyName}" class="w-full h-32 object-cover rounded-t-lg mb-4">` : '';

    cardLink.innerHTML = `
        ${thumbnail}
        <div class="p-2">
            <p class="text-sm text-gray-600">${data.companyName || ''}</p>
            <h3 class="font-bold text-lg">${data.personName || ''}</h3>
            <p class="text-sm text-gray-500">${data.department || ''}</p>
        </div>
    `;
    return cardLink;
}

// イベントリスナー
loadMoreButton.addEventListener('click', () => fetchCards());
searchButton.addEventListener('click', () => {
    // TODO: 検索機能の実装
    alert('検索機能は現在実装中です。');
});
