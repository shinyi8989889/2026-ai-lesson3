# 更新日誌

所有重大變更皆記錄於此文件。格式參考 [Keep a Changelog](https://keepachangelog.com/)。

## [Unreleased]

### Added
- 綠界 ECPay AIO 金流串接：結帳後導向綠界付款頁面完成真實付款流程
- 新增 `src/utils/ecpay.js` 工具模組：CheckMacValue 簽章產生/驗證、ECPay 專用 URL 編碼、QueryTradeInfo API 查詢
- 新增 `GET /ecpay/payment/:orderId` 頁面路由：產生自動送出的 ECPay 付款表單
- 新增 `POST /api/orders/:id/check-payment` API：透過 QueryTradeInfo API 主動查詢付款狀態（取代本地端無法接收的 Server Notify）
- 訂單新增 `merchant_trade_no` 欄位：對應綠界 MerchantTradeNo，由 order_no 去除連字號產生
- 新增 `src/utils/shipping.js` 運費計算模組：宅配基本運費 120 元 / 超商取貨 60 元、商品小計滿 1,500 元免宅配基本運費、偏遠地區加收 200 元、當日急件加收 250 元，並可獨立單元測試
- `POST /api/orders` 整合運費計算：request body 新增 `shippingMethod`、`isRemote`、`isUrgent`（皆選填，預設宅配、皆非），回應新增 `product_subtotal`、`shipping_fee`、`shipping_method`、`is_remote`、`is_urgent`，`total_amount` 改為商品小計 + 運費
- 訂單新增 `shipping_fee`、`shipping_method`、`is_remote`、`is_urgent` 欄位
- 新增 `tests/shipping.test.js`：運費計算模組單元測試（涵蓋基本運費、超商取貨、滿額免運門檻、偏遠地區、急件、多項附加費疊加等情境）

### Changed
- 結帳頁面（checkout.js）：送出訂單後導向綠界付款頁面，不再直接跳轉訂單詳情
- 訂單詳情頁面（order-detail.ejs / order-detail.js）：原「付款成功/失敗」模擬按鈕改為「查詢付款狀態」與「前往付款」按鈕；從綠界導回時自動觸發付款狀態查詢

## [1.0.0] - 2026-04-12

### 新增
- 使用者註冊、登入、個人資料 API
- 商品列表與詳情 API（公開）
- 購物車 CRUD API（雙模式認證：JWT / X-Session-Id）
- 訂單建立、查詢、模擬付款 API
- 後台商品管理 API（CRUD）
- 後台訂單查詢 API（含狀態篩選）
- EJS 前台頁面（首頁、商品詳情、購物車、結帳、訂單）
- EJS 後台頁面（商品管理、訂單管理）
- SQLite 資料庫自動初始化與種子資料
- Vitest 測試套件（6 個測試檔案，循序執行）
- Swagger/OpenAPI 文件生成
- Tailwind CSS 樣式系統
- 專案文件結構建立
