
const fs = require('fs');
const path = require('path');
const {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment,
} = require('@firebase/rules-unit-testing');

// --- テスト環境のセットアップ ---
let testEnv;
const PROJECT_ID = `bizknot-test-${Date.now()}`;
const adminUser = { uid: "admin_user_id", email: "admin@example.com" };

beforeAll(async () => {
    // テスト環境を初期化
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            host: 'localhost',
            port: 8080,
            rules: fs.readFileSync('firestore.rules', 'utf8'),
        },
    });
});

afterAll(async () => {
    // テスト環境をクリーンアップ
    await testEnv.cleanup();
});

// --- テストケース ---

describe('BizKnot 論理削除機能の単体テスト', () => {

    // テストごとのデータクリーンアップ
    afterEach(async () => {
        await testEnv.clearFirestore();
    });

    /**
     * detail.js の論理削除処理を模倣したテスト
     */
    test('シナリオ1: 削除ボタンを押すと、isDeletedフラグがtrueに更新される', async () => {
        const adminDb = testEnv.authenticatedContext(adminUser.uid).firestore();
        const cardId = "test_card_01";

        // 1. テスト用の名刺データを作成 (フィールド名を userId に修正)
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await db.collection('business_cards').doc(cardId).set({
                name: "テスト太郎",
                userId: adminUser.uid, // <--- 修正
                isDeleted: false,
                createdAt: new Date(),
            });
        });
        
        // 2. detail.jsの削除処理を模倣（update処理）
        const docRef = adminDb.collection('business_cards').doc(cardId);
        await assertSucceeds(docRef.update({
            isDeleted: true,
            deletedAt: new Date()
        }));

        // 3. 結果の検証: isDeleted が true になっていることを確認
        const updatedDoc = await adminDb.collection('business_cards').doc(cardId).get();
        const data = updatedDoc.data();
        
        expect(data.isDeleted).toBe(true);
        expect(data.deletedAt).not.toBeUndefined();
    });


    /**
     * list.js のフィルタリング処理を模倣したテスト
     */
    test('シナリオ2: 一覧表示の際、isDeletedがtrueの名刺は取得されない', async () => {
        const adminDb = testEnv.authenticatedContext(adminUser.uid).firestore();

        // 1. テストデータを準備 (フィールド名を userId に修正)
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await db.collection('business_cards').add({ name: "表示される太郎", userId: adminUser.uid, isDeleted: false }); // <--- 修正
            await db.collection('business_cards').add({ name: "削除された花子", userId: adminUser.uid, isDeleted: true });  // <--- 修正
        });

        // 2. list.js のクエリを模倣 (クエリ条件を `userId` に修正)
        const query = adminDb.collection('business_cards')
                             .where('userId', '==', adminUser.uid) // <--- 修正
                             .where('isDeleted', '!=', true);
        
        const snapshot = await assertSucceeds(query.get());

        // 3. 結果の検証
        expect(snapshot.size).toBe(1);
        const fetchedData = snapshot.docs[0].data();
        expect(fetchedData.name).toBe("表示される太郎");
        expect(fetchedData.isDeleted).toBe(false);
    });

});
