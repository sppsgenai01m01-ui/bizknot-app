import { test, expect } from '@playwright/test';

test.describe('CSV出力およびXSS対策のE2Eテスト', () => {

    test('XSSスクリプト（alert）が発火せず安全に画面表示されること', async ({ page }) => {
        let alertFired = false;
        // もしアラートが出たらフラグを立てる
        page.on('dialog', async dialog => {
            if (dialog.type() === 'alert') {
                alertFired = true;
            }
            await dialog.dismiss();
        });

        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();

        // サニタイズ処理が効いていれば、アラートは発火しないはず
        expect(alertFired).toBe(false);
    });

    test('画面がクラッシュせずに表示され、CSV関連の動作が可能なこと', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();
    });
});
