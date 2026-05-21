
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const cardDetailContainer = document.getElementById('card-detail-container');
    const loadingIndicator = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const deleteButton = document.getElementById('delete-button');

    // URLから名刺のIDを取得
    const getCardId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    };

    const cardId = getCardId();

    // ログイン状態の確認
    auth.onAuthStateChanged(user => {
        if (user) {
            if (cardId) {
                fetchCardDetails(cardId);
            } else {
                showError('名刺IDが指定されていません。');
            }
        } else {
            // 未ログインであれば、ログインページへリダイレクト
            window.location.href = 'index.html';
        }
    });

    // 名刺の詳細情報をFirestoreから取得して表示
    const fetchCardDetails = async (id) => {
        try {
            const docRef = db.collection('business_cards').doc(id);
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                renderCardDetails(data);
                showLoading(false);
            } else {
                showError('該当する名刺データが見つかりませんでした。');
            }
        } catch (error) {
            console.error("Error fetching document: ", error);
            showError('データの取得中にエラーが発生しました。');
        }
    };

    // 取得したデータをHTMLにレンダリング
    const renderCardDetails = (data) => {
        // 安全な値の表示（XSS対策）
        const escapeHTML = (str) => str ? str.replace(/[&<>"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[tag])) : '';

        cardDetailContainer.innerHTML = `
            <div class="p-6">
                <div class="pb-5 border-b border-gray-200">
                    <h3 class="text-lg leading-6 font-medium text-gray-900">
                        ${escapeHTML(data.company)}
                    </h3>
                    <p class="mt-1 max-w-2xl text-sm text-gray-500">
                        ${escapeHTML(data.department)} / ${escapeHTML(data.title)}
                    </p>
                </div>
                <dl class="mt-5 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">氏名</dt>
                        <dd class="mt-1 text-sm text-gray-900 font-bold text-xl">${escapeHTML(data.name)}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">メールアドレス</dt>
                        <dd class="mt-1 text-sm text-gray-900"><a href="mailto:${escapeHTML(data.email)}" class="text-blue-500 hover:underline">${escapeHTML(data.email)}</a></dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">電話番号</dt>
                        <dd class="mt-1 text-sm text-gray-900">${escapeHTML(data.tel)}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">住所</dt>
                        <dd class="mt-1 text-sm text-gray-900">${escapeHTML(data.address)}</dd>
                    </div>
                    <div class="sm:col-span-2">
                        <dt class="text-sm font-medium text-gray-500">メモ</dt>
                        <dd class="mt-1 text-sm text-gray-900 whitespace-pre-wrap">${escapeHTML(data.notes)}</dd>
                    </div>
                     <div class="sm:col-span-2">
                        <dt class="text-sm font-medium text-gray-500">登録日</dt>
                        <dd class="mt-1 text-sm text-gray-900">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : '不明'}</dd>
                    </div>
                </dl>
            </div>
        `;
    };

    // 削除ボタンの処理
    deleteButton.addEventListener('click', async () => {
        if (!cardId) return;

        if (confirm('この名刺を本当に削除しますか？この操作は元に戻せません。')) {
            try {
                await db.collection('business_cards').doc(cardId).delete();
                alert('名刺を削除しました。');
                window.location.href = 'business_card_list.html'; // 一覧ページにリダイレクト
            } catch (error) {
                console.error("Error deleting document: ", error);
                alert('削除中にエラーが発生しました。');
            }
        }
    });

    // 表示状態の管理
    const showLoading = (isLoading) => {
        loadingIndicator.classList.toggle('hidden', !isLoading);
        cardDetailContainer.classList.toggle('hidden', isLoading);
    };

    const showError = (message) => {
        loadingIndicator.classList.add('hidden');
        errorMessage.querySelector('p').textContent = message;
        errorMessage.classList.remove('hidden');
        deleteButton.classList.add('hidden');
    };
});
