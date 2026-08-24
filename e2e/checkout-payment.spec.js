const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ADMIN_EMAIL = 'admin@hexschool.com';
const ADMIN_PASSWORD = '12345678';

test.describe('結帳與綠界付款流程', () => {
  test('登入 → 加入購物車 → 結帳 → 綠界付款 → 驗證訂單已付款', async ({ page, request }) => {
    // 1. 登入花卉電商
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('**/');
    const token = await page.evaluate(() => localStorage.getItem('flower_token'));
    expect(token).toBeTruthy();

    // 2. 選擇商品並加入購物車（首頁第一張商品卡）
    await page.goto('/');
    const firstAddToCartBtn = page.getByRole('button', { name: /加入購物車/ }).first();
    await firstAddToCartBtn.click();
    await expect(page.locator('#cart-badge')).toBeVisible();

    // 3. 進入結帳頁面
    await page.goto('/cart');
    await page.getByRole('button', { name: '前往結帳' }).click();
    await page.waitForURL('**/checkout');

    // 4. 填寫配送方式與結帳資料
    await page.locator('input[placeholder="請輸入收件人姓名"]').fill('E2E 測試收件人');
    await page.locator('input[placeholder="請輸入 Email"]').fill('e2e-test@example.com');
    await page.locator('input[placeholder="請輸入收件地址"]').fill('台北市信義區測試路 1 號');
    await page.locator('input[type="radio"][value="home_delivery"]').check();

    // 5. 建立訂單
    await page.getByRole('button', { name: '確認送出訂單' }).click();

    // 6. 前往綠界測試環境（結帳頁會導向 /ecpay/payment/:id，該頁自動送出表單）
    await page.waitForURL(/payment-stage\.ecpay\.com\.tw/, { timeout: 30000 });

    // 取得目前訂單 id（從結帳後導回位址推導，稍後用於 API 驗證）
    // 訂單頁 ClientBackURL 帶有 /orders/:id，先記錄下來，等付款完成導回後再讀取
    let orderId = null;

    // 7. 選擇「網路ATM」（listitem 的 accessible name 是英文代碼 WebATM，改用可見文字比對）
    await page.getByText('網路ATM', { exact: true }).click();

    // 8. 選擇「台灣土地銀行」（頁面上有多個 <select>，僅目前可見的那個對應「網路ATM」）
    const bankSelect = page.locator('select:visible').filter({ has: page.locator('option', { hasText: '台灣土地銀行' }) });
    const bankOptionValue = await bankSelect.locator('option', { hasText: '台灣土地銀行' }).getAttribute('value');
    await bankSelect.selectOption(bankOptionValue);

    // 9. 點擊「前往付款」（頁面上是 <a> 連結而非 <button>）
    await page.getByRole('link', { name: '前往付款' }).click();

    // 10. 關閉提示視窗
    const closeButton = page.getByRole('button', { name: /關閉|close/i }).first();
    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();
    }

    // 11. 在土地銀行測試頁面點擊 Save
    await page.getByRole('button', { name: 'Save' }).click({ timeout: 30000 });

    // 12. 等待綠界顯示付款成功
    await page.getByText('付款成功', { exact: false }).first().waitFor({ timeout: 30000 });

    // 13. 點擊「返回商店」（同樣是 <a> 連結）
    await page.getByRole('link', { name: /返回商店/ }).click();

    // 14. 驗證訂單顯示「已付款」
    await page.waitForURL(/\/orders\//, { timeout: 30000 });
    orderId = page.url().match(/\/orders\/([^/?]+)/)?.[1];
    await expect(page.getByText('已付款', { exact: false }).first()).toBeVisible({ timeout: 15000 });

    // 15. 驗證訂單狀態為 paid（雙重驗證，不只信任畫面文字）
    expect(orderId).toBeTruthy();
    const orderRes = await request.get(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(orderRes.ok()).toBeTruthy();
    const orderBody = await orderRes.json();
    expect(orderBody.data.status).toBe('paid');

    // 需要有付款、並返回站點後的成功截圖
    const screenshotDir = path.join(__dirname, 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'payment-success.png'), fullPage: true });
  });
});
