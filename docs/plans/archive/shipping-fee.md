# 運費計算（Shipping）模組

## Context

花卉電商「建立訂單」流程（`src/routes/orderRoutes.js` `POST /api/orders`）原僅計算商品小計作為 `total_amount`，無運費概念。本次新增可獨立測試的運費計算模組，依配送方式、滿額門檻、偏遠地區與急件等條件計算運費，並整合進訂單建立流程。

## 費用規則

- 宅配基本運費：120 元
- 超商取貨（非「基本運費」）：60 元，**不受滿額免運規則影響**
- 商品小計 ≥ 1,500 元：**免「基本運費」**（僅指宅配的 120 元；超商取貨的 60 元不因此免除）
- 偏遠地區：加收 200 元（可與配送方式、免運同時疊加）
- 當日急件：加收 250 元（同上）

## 整體流程

```
POST /api/orders（帶 shippingMethod / isRemote / isUrgent，皆選填）
  → 驗證收件人資訊 + shippingMethod 合法性
  → 取得購物車品項、檢查庫存
  → 計算 productSubtotal = Σ(price × quantity)
  → calculateShippingFee({ subtotal, shippingMethod, isRemote, isUrgent })
  → totalAmount = productSubtotal + shippingFee
  → 🔒 Transaction：INSERT orders（含 shipping_fee/shipping_method/is_remote/is_urgent）
      → INSERT order_items → UPDATE stock → DELETE cart_items
  → 回傳 201（含 product_subtotal、shipping_fee、shipping_method、is_remote、is_urgent、total_amount）
```

## 實作步驟

### Step 1: 新增 `src/utils/shipping.js`

純函式模組（CommonJS，仿 `src/utils/ecpay.js` 風格）：
- `SHIPPING_CONFIG`：費率常數（120 / 60 / 1500 / 200 / 250）
- `SHIPPING_METHODS`：`{ HOME_DELIVERY: 'home_delivery', CVS: 'cvs' }`
- `calculateShippingFee({ subtotal, shippingMethod, isRemote, isUrgent })`：回傳 `{ shippingMethod, baseFee, remoteSurcharge, urgentSurcharge, totalFee, freeShippingApplied }`；`subtotal` 非法或 `shippingMethod` 不在 enum 內時 `throw Error`

### Step 2: 修改 `src/database.js`

比照 `merchant_trade_no` 的 migration 模式，新增 4 個欄位：`shipping_fee`（INTEGER DEFAULT 0）、`shipping_method`（TEXT DEFAULT 'home_delivery'）、`is_remote`（INTEGER DEFAULT 0）、`is_urgent`（INTEGER DEFAULT 0）。

### Step 3: 整合進 `src/routes/orderRoutes.js`

- `POST /api/orders`：解構 `shippingMethod`（預設 home_delivery）、`isRemote`/`isUrgent`（預設 false），驗證後呼叫 `calculateShippingFee`，併入 `total_amount`，寫入新欄位，回應曝光運費明細；更新 `@openapi` JSDoc。
- 新增 `serializeOrder()` 輔助函式，將 `is_remote`/`is_urgent` 的 0/1 轉為 boolean，套用於 `GET /:id`、`PATCH /:id/pay`、`POST /:id/check-payment` 各回應分支。

### Step 4: 更新 `openapi.json`

執行 `npm run openapi` 重新產生。

### Step 5: 文件更新

`docs/ARCHITECTURE.md`（目錄樹、DB schema、資料流、路由表、新增運費規則表格）、`docs/FEATURES.md`（功能總覽、POST /api/orders 業務規則與錯誤碼）、`docs/CHANGELOG.md`（Unreleased/Added）、`docs/TESTING.md`（測試檔案表、sequence 順序）。

### Step 6: 新增單元測試 `tests/shipping.test.js`

純函式單元測試（不透過 HTTP/DB），涵蓋：宅配基本運費、超商取貨費用、小計 1,499/1,500 元邊界、偏遠地區、急件、多項附加費疊加、滿額免運與附加費同時成立、超商取貨不受滿額免運影響、預設值、無效輸入。`vitest.config.js` 的 `sequence.files` 尾端加入 `tests/shipping.test.js`。

## 檔案變更總覽

| 檔案 | 動作 | 說明 |
|---|---|---|
| `src/utils/shipping.js` | 新增 | 運費計算純函式模組 |
| `src/database.js` | 修改 | 新增 4 個 migration 欄位 |
| `src/routes/orderRoutes.js` | 修改 | 整合運費計算、`serializeOrder()`、更新 JSDoc |
| `openapi.json` | 重新產生 | `npm run openapi` |
| `docs/ARCHITECTURE.md` / `FEATURES.md` / `CHANGELOG.md` / `TESTING.md` | 修改 | 同步運費相關說明 |
| `tests/shipping.test.js` | 新增 | 運費模組單元測試（13 案例） |
| `vitest.config.js` | 修改 | `sequence.files` 加入新測試檔 |

## 驗證方式

1. `npm run test`：全部測試通過（含 `tests/shipping.test.js`）。
2. `npm run openapi`：確認 `openapi.json` 含新欄位。
3. 手動以 `curl` 呼叫 `POST /api/orders`，驗證預設宅配、`cvs`、滿額免運、`isRemote`/`isUrgent` 疊加、無效 `shippingMethod` 皆回應正確。

**結果**：以上驗證皆已於實作階段完成並通過。
