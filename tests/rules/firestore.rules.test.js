import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
let testEnv;
describe('Firestore Security Rules', () => {
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: 'bizknot-asever-test',
            firestore: { rules: readFileSync('firestore.rules', 'utf8') }
        });
    });
    afterAll(async () => { await testEnv.cleanup(); });
    beforeEach(async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await db.collection('users').doc('user1').set({ status: 'ACTIVE', permission: 'user' });
            await db.collection('users').doc('admin1').set({ status: 'ACTIVE', permission: 'admin' });
            await db.collection('users').doc('suspended1').set({ status: 'SUSPENDED', permission: 'user' });
            await db.collection('businessCards').doc('card1').set({ userId: 'user1', name: '既存名刺' });
        });
    });
    it('停止ユーザー(SUSPENDED)は名刺データの読み取りが拒否されること', async () => {
        const db = testEnv.authenticatedContext('suspended1').firestore();
        await assertFails(db.collection('businessCards').doc('card1').get());
    });
    it('一般ユーザーは監査ログ(auditLogs)の読み取りが拒否されること', async () => {
        const db = testEnv.authenticatedContext('user1').firestore();
        await assertFails(db.collection('auditLogs').get());
    });
    it('管理者は監査ログ(auditLogs)の読み取りが許可されること', async () => {
        const db = testEnv.authenticatedContext('admin1').firestore();
        await assertSucceeds(db.collection('auditLogs').get());
    });
});
