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

    // 【重要】テスト実行前に、ルール検証で参照されるユーザーデータをモックとして保存しておく
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const users = {
            'alice_uid': { status: 'ACTIVE', permission: 'user' },
            'bob_uid': { status: 'ACTIVE', permission: 'user' },
            'attacker_uid': { status: 'ACTIVE', permission: 'user' },
            'user_uid': { status: 'ACTIVE', permission: 'user' },
            'admin_uid': { status: 'ACTIVE', permission: 'admin' }, // Admin user for testing admin-only rules
        };

        for (const [uid, data] of Object.entries(users)) {
            await db.collection('users').doc(uid).set(data);
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
        await testEnv.withSecurityRulesDisabled(async context => {
            await context.firestore().collection('businessCards').doc('alice_card_read').set({ ownerId: 'alice_uid', companyName: 'アリス社' });
        });

        const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
        await assertFails(bobDb.collection('businessCards').doc('alice_card_read').get());
    });

    it('🔴 他人の名刺データを更新しようとした場合は失敗すること', async () => {
        await testEnv.withSecurityRulesDisabled(async context => {
            await context.firestore().collection('businessCards').doc('alice_card_update').set({ ownerId: 'alice_uid', companyName: 'アリス社' });
        });

        const attackerDb = testEnv.authenticatedContext('attacker_uid').firestore();
        const targetCard = attackerDb.collection('businessCards').doc('alice_card_update');
        await assertFails(targetCard.update({ companyName: 'ハッキング社' }));
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

describe('Firestore Security Rules: businessCards (論理削除の保護)', () => {
    const logicallyDeletedCardId = 'deleted_card_01';
    const ownerUid = 'user_uid';

    // 事前に論理削除済みのデータを投入
    beforeAll(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await db.collection('businessCards').doc(logicallyDeletedCardId).set({
                ownerId: ownerUid,
                companyName: '削除済み会社',
                deletedAt: new Date() // 論理削除フラグ
            });
        });
    });

    it('🔴 一般ユーザーは論理削除された名刺を読み取れないこと', async () => {
        const userDb = testEnv.authenticatedContext(ownerUid).firestore();
        const ref = userDb.collection('businessCards').doc(logicallyDeletedCardId);
        await assertFails(ref.get());
    });

    it('🟢 管理者は論理削除された名刺を読み取れること', async () => {
        const adminDb = testEnv.authenticatedContext('admin_uid').firestore();
        const ref = adminDb.collection('businessCards').doc(logicallyDeletedCardId);
        await assertSucceeds(ref.get());
    });
    
    it('🔴 一般ユーザーは論理削除された名刺を更新できないこと', async () => {
        const userDb = testEnv.authenticatedContext(ownerUid).firestore();
        const ref = userDb.collection('businessCards').doc(logicallyDeletedCardId);
        await assertFails(ref.update({ companyName: '更新試行' }));
    });
    
    it('🔴 [仕様確認] 一般ユーザーは自分の名刺に deletedAt を設定（論理削除）できないこと', async () => {
        const userDb = testEnv.authenticatedContext(ownerUid).firestore();
        const cardRef = userDb.collection('businessCards').doc('my_active_card');
        
        // まずは通常のカードを作成
        await assertSucceeds(cardRef.set({ ownerId: ownerUid, companyName: 'アクティブ株式会社' }));
        
        // 論理削除を試みる (deletedAt を設定して更新する)
        // 現行ルールでは、ユーザーは deletedAt の値を変更・設定できないため、この操作は失敗するはず
        await assertFails(cardRef.update({ deletedAt: new Date() }));
    });
});