import { test, expect } from '@playwright/test';

test('トップページ（ログイン画面）が正常に読み込まれること', async ({ page }) => {
    await page.goto('/');
    // 画面の基本要素(body)がクラッシュせずに表示されているか確認
    await expect(page.locator('body')).toBeVisible();
});
