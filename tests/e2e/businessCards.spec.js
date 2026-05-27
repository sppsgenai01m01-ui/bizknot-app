import { test, expect } from '@playwright/test';

test.describe('BizKnot 名刺管理 E2E UIテスト', () => {

  test.beforeEach(async ({ page }) => {
    // テスト用の認証モックフラグをセットするために、一度ルートにアクセス
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('e2e_test_mode', 'true');
    });
  });

  // ==========================================
  // 1. 名刺の新規作成フローの検証
  // ==========================================
  test('名刺の新規作成画面が正しく表示され、フォームに入力できること', async ({ page }) => {
    // 開発サーバーのURLに合わせてアクセス
    await page.goto('/business_card_creation.html');

    // 画面の基本要素が表示されているか確認
    await expect(page.locator('h1').first()).toContainText('BizKnot');
    await expect(page.locator('h2')).toContainText('AIで自動入力 (OCR)');
    await expect(page.locator('#ocr-button')).toBeVisible();

    // フォームへの入力シミュレーション（ユーザーのタイピング操作）
    await page.fill('#company', '株式会社テストUI');
    await page.fill('#department', '開発部');
    await page.fill('#position', 'エンジニア');
    await page.fill('#name', '自動 テスト');
    await page.fill('#email', 'test@example.com');
    await page.fill('#tel', '03-1234-5678');

    // 入力値が正しく反映されているか確認
    await expect(page.locator('#company')).toHaveValue('株式会社テストUI');

    // 登録ボタンがクリック可能な状態か確認
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  // ==========================================
  // 2. 名刺一覧表示と検索フィルタリングの検証
  // ==========================================
  test('名刺一覧画面が正しく表示され、検索機能のUIが動作すること', async ({ page }) => {
    await page.goto('/business_card_list.html');

    // 画面タイトルとCSVエクスポートボタンの確認
    await expect(page.locator('h2').first()).toContainText('全社ネットワーク検索');
    
    // PC表示の際にCSVエクスポートボタンが表示されているか
    const exportBtn = page.locator('#export-csv-button');
    await expect(exportBtn).toBeVisible();

    // 検索ボックスへの入力とボタンクリックのシミュレーション
    const searchInput = page.locator('#search-keyword');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Playwright');

    const searchBtn = page.locator('#search-button');
    await expect(searchBtn).toBeEnabled();
    await searchBtn.click();

    // カードリストのコンテナが存在しているか（PC版かスマホ版のいずれか）
    const hasPcTable = await page.locator('#pc-table-body').count() > 0;
    const hasMobileList = await page.locator('#mobile-card-list').count() > 0;
    expect(hasPcTable || hasMobileList).toBeTruthy();
  });

});