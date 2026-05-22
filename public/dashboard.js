console.log("【最終確認】dashboard.jsは、確かに読み込まれました。");

document.addEventListener('DOMContentLoaded', () => {

    console.log("DOMContentLoadedイベントが発火しました。イベントリスナーを設定します。");

    // --- DOM Elements ---
    const userDisplayName = document.getElementById('user-display-name');
    const logoutButton = document.getElementById('logout-button');
    const summaryCardCount = document.getElementById('summary-card-count');
    const recentCardsList = document.getElementById('recent-cards-list');
    const recentCardsListSkeleton = document.getElementById('recent-cards-list-skeleton');
    const adminMenu = document.getElementById('admin-menu');

    // --- Button Elements for Navigation ---
    const addCardButton = document.getElementById('add-card-button');
    const listCardsButton = document.getElementById('list-cards-button');
    const userManagementButton = document.getElementById('user-management-button');
    const auditLogButton = document.getElementById('audit-log-button');

    // --- Firebase Initialization ---
    // NOTE: This assumes Firebase is initialized in the HTML file from the CDN.
    const db = firebase.firestore();

    // --- Authentication State Observer ---
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("ログイン済みのユーザーです: ", user.uid);
            fetchUserData(user);
            fetchDashboardData();
        } else {
            console.log("未ログインのユーザーです。ログインページにリダイレクトします。");
            window.location.href = 'index.html';
        }
    });

    // --- Data Fetching Functions ---
    function fetchUserData(user) {
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                userDisplayName.innerHTML = `ようこそ、<span class="font-semibold">${userData.displayName || 'ユーザー'}</span>さん`;
                if (userData.permission === 'admin') {
                    console.log("管理者権限を検出しました。管理者メニューを表示します。");
                    adminMenu.classList.remove('hidden');
                }
            } else {
                console.warn("Firestoreにユーザーデータが見つかりませんでした。");
                userDisplayName.innerHTML = `ようこそ、<span class="font-semibold">ゲスト</span>さん`;
            }
        }).catch(error => {
            console.error("ユーザーデータの取得に失敗しました:", error);
        });
    }

    function fetchDashboardData() {
        db.collection('businessCards').get().then(snapshot => {
            let count = 0;
            snapshot.forEach(doc => {
                if (!doc.data().deletedAt) count++;
            });
            summaryCardCount.textContent = count;
        }).catch(error => {
            console.error("名刺総数の取得に失敗しました:", error);
            summaryCardCount.textContent = 'N/A';
        });

        // 論理削除をフィルタリングするため多めに取得
        db.collection('businessCards').orderBy('createdAt', 'desc').limit(20).get().then(snapshot => {
            recentCardsList.innerHTML = '';
            if (snapshot.empty) {
                recentCardsList.innerHTML = '<p class="text-gray-500">まだ名刺は登録されていません。</p>';
            } else {
                let displayedCount = 0;
                snapshot.forEach(doc => {
                    const card = doc.data();
                    if (card.deletedAt) return; // 論理削除スキップ
                    if (displayedCount >= 5) return; // 5件まで
                    displayedCount++;

                    const li = document.createElement('li');
                    li.className = 'p-3 hover:bg-gray-100 rounded-md cursor-pointer border-b transition duration-150 ease-in-out';
                    li.innerHTML = `
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-semibold text-gray-800">${card.companyName || '会社名未登録'}</p>
                                <p class="text-sm text-gray-600">${card.name || '氏名未登録'}</p>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </div>
                    `;
                    li.dataset.id = doc.id;
                    li.addEventListener('click', () => {
                        window.location.href = `/business_card_detail.html?id=${doc.id}`;
                    });
                    recentCardsList.appendChild(li);
                });
                
                if (displayedCount === 0) {
                    recentCardsList.innerHTML = '<p class="text-gray-500">まだ名刺は登録されていません。</p>';
                }
            }
            recentCardsListSkeleton.classList.add('hidden');
            recentCardsList.classList.remove('hidden');
        }).catch(error => {
            console.error("最近の名刺リストの取得に失敗しました:", error);
            recentCardsListSkeleton.classList.add('hidden');
            recentCardsList.innerHTML = '<p class="text-red-500">データの取得に失敗しました。</p>';
        });
    }

    // --- Event Listeners ---
    logoutButton.addEventListener('click', () => {
        firebase.auth().signOut().catch(error => {
            console.error("ログアウトに失敗しました:", error);
            alert("ログアウトに失敗しました。");
        });
    });
    
    // --- CORRECTED Navigation button listeners ---
    if (addCardButton) {
        console.log("「名刺登録」ボタンが見つかりました。クリックイベントを設定します。");
        addCardButton.addEventListener('click', () => { window.location.href = 'business_card_creation.html'; });
    } else {
        console.error("致命的エラー: 「名刺登録」ボタン(id='add-card-button')がHTML内に見つかりません。");
    }

    if (listCardsButton) {
        console.log("「名刺一覧」ボタンが見つかりました。クリックイベントを設定します。");
        listCardsButton.addEventListener('click', () => { window.location.href = 'business_card_list.html'; });
    } else {
        console.error("エラー: 「名刺一覧」ボタン(id='list-cards-button')がHTML内に見つかりません。");
    }
    
    // Admin navigation
    if(userManagementButton) userManagementButton.addEventListener('click', () => { window.location.href = 'user-management.html'; });
    if(auditLogButton) auditLogButton.addEventListener('click', () => { window.location.href = 'audit-log.html'; });

});
