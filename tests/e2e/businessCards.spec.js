import { test, expect } from '@playwright/test';

test.describe('BizKnot 名刺管理 E2E UIテスト', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('e2e_test_mode', 'true');
    });
  });

  // ==========================================
  // 1. 名刺の手動入力フォーム画面の検証
  // ==========================================
  test('名刺の手動入力画面が正しく表示され、フォームに入力できること', async ({ page }) => {
    // 【修正】カメラ画面ではなく、手動入力フォーム画面に直接アクセスする
    await page.goto('/business_card_form.html');

    // h1が正しく表示されているか確認
    await expect(page.locator('h1').first()).toContainText('BizKnot');

    // フォームへの入力シミュレーション（IDを実際のHTMLに存在する正確なものに修正）
    await page.fill('#company', '株式会社テストUI');
    await page.fill('#department', '開発部');
    await page.fill('#title', 'エンジニア'); // #position から #title へ修正
    await page.fill('#name', '自動 テスト');
    await page.fill('#email', 'test@example.com');
    await page.fill('#company_tel', '03-1234-5678'); // #tel から #company_tel へ修正

    await expect(page.locator('#company')).toHaveValue('株式会社テストUI');

    // 登録ボタンの確認
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  // ==========================================
  // 2. 名刺一覧表示と検索フィルタリングの検証
  // ==========================================
  test('名刺一覧画面が正しく表示され、検索機能のUIが動作すること', async ({ page }) => {
    await page.goto('/business_card_list.html');

    await expect(page.locator('h2').first()).toContainText('全社ネットワーク検索');
    
    const exportBtn = page.locator('#export-csv-button');
    await expect(exportBtn).toBeVisible();

    const searchInput = page.locator('#search-keyword');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Playwright');

    const searchBtn = page.locator('#search-button');
    await expect(searchBtn).toBeEnabled();
    await searchBtn.click();

    const hasPcTable = await page.locator('#pc-table-body').count() > 0;
    const hasMobileList = await page.locator('#mobile-card-list').count() > 0;
    expect(hasPcTable || hasMobileList).toBeTruthy();
  });

});