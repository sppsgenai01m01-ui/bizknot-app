document.addEventListener('DOMContentLoaded', () => {

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
    // No emulator code is needed here for the deployed version.
    const db = firebase.firestore();

    // --- Authentication State Observer ---
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // User is signed in. Let's fetch their data.
            console.log("ログイン済みのユーザーです: ", user.uid);
            fetchUserData(user);
            fetchDashboardData();
        } else {
            // No user is signed in. Redirect to login page.
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
                // Display user's name
                userDisplayName.innerHTML = `ようこそ、<span class="font-semibold">${userData.displayName || 'ユーザー'}</span>さん`;
                
                // Show admin menu based on permission
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
        // 1. Fetch summary count
        db.collection('businessCards').get().then(snapshot => {
            summaryCardCount.textContent = snapshot.size;
        }).catch(error => {
            console.error("名刺総数の取得に失敗しました:", error);
            summaryCardCount.textContent = 'N/A';
        });

        // 2. Fetch recent cards
        db.collection('businessCards').orderBy('createdAt', 'desc').limit(5).get().then(snapshot => {
            recentCardsList.innerHTML = ''; // Clear the list
            if (snapshot.empty) {
                recentCardsList.innerHTML = '<p class="text-gray-500">まだ名刺は登録されていません。</p>';
            } else {
                snapshot.forEach(doc => {
                    const card = doc.data();
                    const li = document.createElement('li');
                    li.className = 'p-3 hover:bg-gray-100 rounded-md cursor-pointer border-b';
                    li.innerHTML = `
                        <p class="font-semibold text-gray-800">${card.companyName || '会社名未登録'}</p>
                        <p class="text-sm text-gray-600">${card.personName || '氏名未登録'}</p>
                    `;
                    li.dataset.id = doc.id; // Store document id for click events
                    recentCardsList.appendChild(li);
                });
            }
            // Hide skeleton and show the list
            recentCardsListSkeleton.classList.add('hidden');
            recentCardsList.classList.remove('hidden');
        }).catch(error => {
            console.error("最近の名刺リストの取得に失敗しました:", error);
            recentCardsListSkeleton.classList.add('hidden');
            recentCardsList.innerHTML = '<p class="text-red-500">データの取得に失敗しました。</p>'; // Removed one >
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
    addCardButton.addEventListener('click', () => { window.location.href = 'business_card_form.html'; });
    listCardsButton.addEventListener('click', () => { window.location.href = 'business_card_list.html'; });
    
    // Admin navigation
    userManagementButton.addEventListener('click', () => { window.location.href = 'user-management.html'; });
    auditLogButton.addEventListener('click', () => { window.location.href = 'audit-log.html'; });

});