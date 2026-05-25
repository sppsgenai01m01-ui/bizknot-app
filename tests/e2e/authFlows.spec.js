import { test, expect } from '@playwright/test';

test.describe('認証・セッション関連の統合テスト (Auth Flows)', () => {
  
  test.beforeEach(async ({ page }) => {
    // 各テストの前にログイン画面（トップ）へ移動
    await page.goto('/index.html');
  });

  test('🔴 ドメイン制限 - 許可されていないドメインを弾くこと', async ({ page }) => {
    // ※今回はアプリ側にドメイン制限を実装済みのため、CI環境で
    // 実際にドメイン検証ロジックが走るか（エラーなくテストが開始できるか）の
    // テストスケルトンとして配置します。
    test.info().annotations.push({ type: 'TODO', description: 'CI環境でのドメイン制限検証' });
  });

  test('🔴 停止ユーザーのログイン排除', async ({ page }) => {
    test.info().annotations.push({ type: 'TODO', description: 'アカウント停止ユーザーのログイン拒否を検証' });
  });

  test('�� 初回自動登録', async ({ page }) => {
    test.info().annotations.push({ type: 'TODO', description: '初回ログイン時にFirestoreのusersにレコードが作成されるか検証' });
  });

  test('🔴 セッション継続中の停止処理', async ({ page }) => {
    test.info().annotations.push({ type: 'TODO', description: '利用中にDBでSUSPENDEDにされた場合、即座に弾かれるか検証' });
  });

  test('🔴 戻るボタン耐性とセッション失効', async ({ page }) => {
    // ログアウトした後に、ブラウザの「戻る」で保護されたページ（名刺一覧など）に
    // アクセスしようとしても、再度ログイン画面にリダイレクトされることを検証
    test.info().annotations.push({ type: 'TODO', description: 'ログアウト後の戻るボタン耐性を検証' });
  });

});
