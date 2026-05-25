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

        // アクセス記録
        if (window.addAuditLog) {
            window.addAuditLog('VIEW_AUDIT_LOG', {});
        }

        const tbody = document.getElementById('audit-list-body');
        const spinner = document.getElementById('loading-spinner');
        let logsData = [];

        async function loadAuditLogs() {
            tbody.innerHTML = '';
            spinner.classList.remove('hidden');
            logsData = [];
            
            try {
                // 最新200件を取得
                const snapshot = await db.collection('auditLogs').orderBy('timestamp', 'desc').limit(200).get();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    logsData.push(data);
                    
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-gray-50 text-sm';
                    
                    const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleString('ja-JP') : '-';
                    const detailsStr = data.details ? JSON.stringify(data.details) : '{}';

                    tr.innerHTML = `
                        <td class="p-3 text-gray-600 whitespace-nowrap">${dateStr}</td>
                        <td class="p-3">${data.userEmail || 'Unknown'}</td>
                        <td class="p-3 font-semibold text-blue-600">${data.action || '-'}</td>
                        <td class="p-3 text-xs text-gray-500 break-all">${detailsStr}</td>
                    `;
                    tbody.appendChild(tr);
                });
                
                if (snapshot.empty) {
                    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">監査ログはありません。</td></tr>`;
                }
            } catch (e) {
                console.error("ログ取得失敗:", e);
                tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">ログの取得に失敗しました。</td></tr>`;
            } finally {
                spinner.classList.add('hidden');
            }
        }

        document.getElementById('export-audit-csv').addEventListener('click', () => {
            if (logsData.length === 0) {
                alert('出力するデータがありません。');
                return;
            }
            if (window.addAuditLog) window.addAuditLog('EXPORT_AUDIT_CSV', { count: logsData.length });
            
            let csvContent = '\uFEFF'; // BOM
            csvContent += '日時,ユーザーEmail,アクション,詳細情報\n';
            
            logsData.forEach(data => {
                const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleString('ja-JP') : '';
                const email = data.userEmail || '';
                const action = data.action || '';
                const details = data.details ? JSON.stringify(data.details).replace(/"/g, '""') : '';
                
                csvContent += `"${dateStr}","${email}","${action}","${details}"\n`;
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_log_${new Date().getTime()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });

        loadAuditLogs();
    });
});
