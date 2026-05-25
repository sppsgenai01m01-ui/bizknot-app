import { test, expect } from '@playwright/test';
test('未ログインユーザーは名刺登録画面から弾かれること', async ({ page }) => {
    await page.goto('/creation.html');
    await expect(page).toHaveURL(/.*index\.html/);
});
