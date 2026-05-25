document.addEventListener('DOMContentLoaded', () => {
    protectPage(async (user) => {
        const db = firebase.firestore();
        
        // 管理者権限チェック
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists || userDoc.data().permission !== 'admin') {
                alert('管理者権限が必要です。');
                window.location.href = '/dashboard.html';
                return;
            }
        } catch (e) {
            console.error(e);
            window.location.href = '/dashboard.html';
            return;
        }

        // 監査ログにアクセス記録
        if (window.addAuditLog) {
            window.addAuditLog('VIEW_USER_MANAGEMENT', {});
        }

        const tbody = document.getElementById('user-list-body');
        const spinner = document.getElementById('loading-spinner');

        async function loadUsers() {
            tbody.innerHTML = '';
            spinner.classList.remove('hidden');
            
            try {
                const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-gray-50 text-sm';
                    
                    const roleSelect = `
                        <select onchange="updateUserRole('${doc.id}', this.value)" class="border rounded px-2 py-1 text-gray-700 bg-white">
                            <option value="user" ${data.permission !== 'admin' ? 'selected' : ''}>一般ユーザー</option>
                            <option value="admin" ${data.permission === 'admin' ? 'selected' : ''}>管理者 (Admin)</option>
                        </select>
                    `;
                    
                    const statusSelect = `
                        <select onchange="updateUserStatus('${doc.id}', this.value)" class="border rounded px-2 py-1 text-gray-700 bg-white ${data.status === 'SUSPENDED' ? 'text-red-500 font-bold' : 'text-green-600'}">
                            <option value="ACTIVE" ${data.status !== 'SUSPENDED' ? 'selected' : ''}>有効 (Active)</option>
                            <option value="SUSPENDED" ${data.status === 'SUSPENDED' ? 'selected' : ''}>利用停止</option>
                        </select>
                    `;

                    tr.innerHTML = `
                        <td class="p-3">${data.displayName || '未設定'}</td>
                        <td class="p-3">${data.email || '未設定'}</td>
                        <td class="p-3">${roleSelect}</td>
                        <td class="p-3">${statusSelect}</td>
                        <td class="p-3 text-gray-400 text-xs">ID: ${doc.id}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) {
                console.error("ユーザー取得失敗:", e);
                tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">ユーザー一覧の取得に失敗しました。</td></tr>`;
            } finally {
                spinner.classList.add('hidden');
            }
        }

        window.updateUserRole = async (userId, newRole) => {
            if (userId === user.uid) {
                alert('自身のアカウントの権限は変更できません。');
                loadUsers();
                return;
            }
            if (confirm('このユーザーの権限を変更しますか？')) {
                try {
                    await db.collection('users').doc(userId).update({ permission: newRole });
                    if (window.addAuditLog) window.addAuditLog('UPDATE_USER_ROLE', { targetUserId: userId, newRole });
                    alert('権限を更新しました。');
                } catch (e) {
                    console.error(e);
                    alert('更新に失敗しました。');
                }
                loadUsers();
            } else {
                loadUsers(); // revert UI
            }
        };

        window.updateUserStatus = async (userId, newStatus) => {
            if (userId === user.uid) {
                alert('自身のアカウントは停止できません。');
                loadUsers();
                return;
            }
            if (confirm(newStatus === 'SUSPENDED' ? 'このユーザーを利用停止にしますか？（次回以降ログインできなくなります）' : 'このユーザーの利用停止を解除しますか？')) {
                try {
                    await db.collection('users').doc(userId).update({ status: newStatus });
                    if (window.addAuditLog) window.addAuditLog('UPDATE_USER_STATUS', { targetUserId: userId, newStatus });
                    alert('ステータスを更新しました。');
                } catch (e) {
                    console.error(e);
                    alert('更新に失敗しました。');
                }
                loadUsers();
            } else {
                loadUsers(); // revert UI
            }
        };

        loadUsers();
    });
});
