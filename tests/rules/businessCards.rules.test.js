import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv;

beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
        projectId: 'demo-test-business-cards',
        firestore: { rules },
    });

    // 【重要】テスト実行前に、ルール検証(isNotSuspended)で参照されるユーザーデータをモックとして保存しておく
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const users = ['alice_uid', 'bob_uid', 'attacker_uid', 'user_uid'];
        for (const uid of users) {
            await db.collection('users').doc(uid).set({
                status: 'ACTIVE',
                permission: 'user'
            });
        }
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

describe('Firestore Security Rules: businessCards (テナント分離とスキーマ検証)', () => {
    it('🟢 自分の名刺データは正しく作成・読み取りできること', async () => {
        const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
        
        const validCardRef = aliceDb.collection('businessCards').doc('card1');
        await assertSucceeds(validCardRef.set({
            ownerId: 'alice_uid',
            companyName: '株式会社テスト',
            email: 'test@example.com'
        }));
        
        await assertSucceeds(validCardRef.get());
    });

    it('🔴 他人の名刺データにはアクセス（読み取り）できないこと', async () => {
        const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
        await assertSucceeds(aliceDb.collection('businessCards').doc('alice_card').set({
            ownerId: 'alice_uid',
            companyName: 'アリス社'
        }));

        const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
        await assertFails(bobDb.collection('businessCards').doc('alice_card').get());
    });

    it('🔴 ownerIdを他人に偽装して作成しようとした場合は失敗すること', async () => {
        const attackerDb = testEnv.authenticatedContext('attacker_uid').firestore();
        
        await assertFails(attackerDb.collection('businessCards').doc('fake_card').set({
            ownerId: 'admin_uid', 
            companyName: '偽装会社'
        }));
    });

    it('🔴 必須項目（companyName）が欠けている場合は失敗すること', async () => {
        const userDb = testEnv.authenticatedContext('user_uid').firestore();
        
        await assertFails(userDb.collection('businessCards').doc('invalid_card').set({
            ownerId: 'user_uid'
        }));
    });

    it('🔴 空文字の会社名で作成しようとした場合は失敗すること', async () => {
        const userDb = testEnv.authenticatedContext('user_uid').firestore();
        
        await assertFails(userDb.collection('businessCards').doc('empty_name_card').set({
            ownerId: 'user_uid',
            companyName: ''
        }));
    });
});
