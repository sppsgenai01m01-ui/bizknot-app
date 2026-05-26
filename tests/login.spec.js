const { test, expect } = require('@playwright/test');

test('Login test', async ({ page }) => {
  // ログインページに移動
  await page.goto('/');

  // ログインフォームに入力
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password');

  // ログインボタンをクリック
  await page.click('button[type="submit"]');

  // ログイン後のダッシュボードにリダイレクトされることを確認
  await expect(page).toHaveURL('/dashboard.html');

  // ダッシュボードに特定のテキストが表示されていることを確認
  await expect(page.locator('h1')).toHaveText('ビジネス交流会');
});
