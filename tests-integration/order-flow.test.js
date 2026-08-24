const { app, request, db, registerUser } = require('./setup');
const { calculateShippingFee } = require('../src/utils/shipping');

function addProductToCart(token, productId, quantity) {
  return request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });
}

function createOrder(token, body) {
  return request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

describe('訂單建立完整流程（Integration Test，使用獨立記憶體資料庫）', () => {
  it('1~5：登入/建立會員 → 取得商品 → 加入購物車 → 建立含配送方式的訂單 → 驗證結果', async () => {
    // 1. 建立測試會員
    const { token, user } = await registerUser();
    expect(user).toHaveProperty('id');

    // 2. 取得商品資料
    const productsRes = await request(app).get('/api/products');
    expect(productsRes.status).toBe(200);
    expect(productsRes.body).toHaveProperty('data');
    expect(productsRes.body).toHaveProperty('error', null);
    const product = productsRes.body.data.products[0];
    expect(product.price).toBeGreaterThan(0);

    const stockBefore = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock;

    // 3. 加入購物車
    const quantity = 1;
    const cartRes = await addProductToCart(token, product.id, quantity);
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.error).toBeNull();

    // 4. 建立含配送方式與配送資訊的訂單
    const orderRes = await createOrder(token, {
      recipientName: '測試收件人',
      recipientEmail: 'recipient@example.com',
      recipientAddress: '台北市測試路 1 號',
      shippingMethod: 'cvs',
      isRemote: true,
      isUrgent: true,
    });

    // 5. 驗證訂單建立結果 -----------------------------------------

    // HTTP 狀態碼與回應格式
    expect(orderRes.status).toBe(201);
    expect(orderRes.body).toHaveProperty('data');
    expect(orderRes.body).toHaveProperty('error', null);
    expect(orderRes.body).toHaveProperty('message');

    const orderId = orderRes.body.data.id;
    const productSubtotal = product.price * quantity;
    const expectedShipping = calculateShippingFee({
      subtotal: productSubtotal,
      shippingMethod: 'cvs',
      isRemote: true,
      isUrgent: true,
    });

    // 訂單是否正確寫入
    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(orderRow).toBeTruthy();
    expect(orderRow.user_id).toBe(user.id);
    expect(orderRow.recipient_name).toBe('測試收件人');
    expect(orderRow.status).toBe('pending');

    // 訂單品項是否正確寫入
    const itemRows = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    expect(itemRows).toHaveLength(1);
    expect(itemRows[0].product_id).toBe(product.id);
    expect(itemRows[0].quantity).toBe(quantity);
    expect(itemRows[0].product_price).toBe(product.price);

    // 配送費用是否正確
    expect(orderRow.shipping_fee).toBe(expectedShipping.totalFee);
    expect(orderRes.body.data.shipping_fee).toBe(expectedShipping.totalFee);
    expect(orderRes.body.data.shipping_method).toBe('cvs');
    expect(orderRes.body.data.is_remote).toBe(true);
    expect(orderRes.body.data.is_urgent).toBe(true);

    // 訂單總額是否正確
    expect(orderRow.total_amount).toBe(productSubtotal + expectedShipping.totalFee);
    expect(orderRes.body.data.total_amount).toBe(productSubtotal + expectedShipping.totalFee);
    expect(orderRes.body.data.product_subtotal).toBe(productSubtotal);

    // 商品庫存是否正確扣除
    const stockAfter = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock;
    expect(stockBefore - stockAfter).toBe(quantity);

    // 建立訂單後購物車是否清空
    const remainingCartRows = db.prepare('SELECT * FROM cart_items WHERE user_id = ?').all(user.id);
    expect(remainingCartRows).toHaveLength(0);

    const cartCheckRes = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(cartCheckRes.body.data.items).toHaveLength(0);
  });

  it('建立訂單失敗（庫存不足）時，不留下不完整訂單，也不會錯誤扣除庫存', async () => {
    const { token, user } = await registerUser();

    const productsRes = await request(app).get('/api/products');
    const product = productsRes.body.data.products.find((p) => p.stock > 0);

    // 加入購物車時庫存足夠（quantity=1），之後模擬「加入購物車後、下單前庫存被其他訂單耗盡」的情境，
    // 直接把該商品庫存改為 0，讓建立訂單時的庫存檢查會失敗。
    const addRes = await addProductToCart(token, product.id, 1);
    expect(addRes.status).toBe(200);

    db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(product.id);

    const stockBefore = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock;
    const ordersCountBefore = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    const orderItemsCountBefore = db.prepare('SELECT COUNT(*) AS c FROM order_items').get().c;

    const orderRes = await createOrder(token, {
      recipientName: '測試收件人',
      recipientEmail: 'recipient@example.com',
      recipientAddress: '台北市測試路 1 號',
    });

    expect(orderRes.status).toBe(400);
    expect(orderRes.body).toHaveProperty('data', null);
    expect(orderRes.body.error).toBe('STOCK_INSUFFICIENT');

    const stockAfter = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock;
    const ordersCountAfter = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    const orderItemsCountAfter = db.prepare('SELECT COUNT(*) AS c FROM order_items').get().c;

    expect(stockAfter).toBe(stockBefore);
    expect(ordersCountAfter).toBe(ordersCountBefore);
    expect(orderItemsCountAfter).toBe(orderItemsCountBefore);

    // 購物車不應被清空（訂單根本沒建立成功）
    const cartRows = db.prepare('SELECT * FROM cart_items WHERE user_id = ?').all(user.id);
    expect(cartRows).toHaveLength(1);
  });

  it('建立訂單失敗（shippingMethod 無效）時，不留下不完整訂單，也不會錯誤扣除庫存', async () => {
    const { token, user } = await registerUser();

    const productsRes = await request(app).get('/api/products');
    const product = productsRes.body.data.products.find((p) => p.stock > 0);
    const addRes = await addProductToCart(token, product.id, 1);
    expect(addRes.status).toBe(200);

    const stockBefore = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock;
    const ordersCountBefore = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;

    const orderRes = await createOrder(token, {
      recipientName: '測試收件人',
      recipientEmail: 'recipient@example.com',
      recipientAddress: '台北市測試路 1 號',
      shippingMethod: 'teleport',
    });

    expect(orderRes.status).toBe(400);
    expect(orderRes.body).toHaveProperty('data', null);
    expect(orderRes.body.error).toBe('VALIDATION_ERROR');

    const stockAfter = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock;
    const ordersCountAfter = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;

    expect(stockAfter).toBe(stockBefore);
    expect(ordersCountAfter).toBe(ordersCountBefore);

    // 購物車不應被清空（訂單根本沒建立成功）
    const cartRows = db.prepare('SELECT * FROM cart_items WHERE user_id = ?').all(user.id);
    expect(cartRows).toHaveLength(1);
  });

  it('建立訂單失敗（購物車為空）時，回傳 400 CART_EMPTY，且不建立訂單', async () => {
    const { token } = await registerUser();

    const ordersCountBefore = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;

    const orderRes = await createOrder(token, {
      recipientName: '測試收件人',
      recipientEmail: 'recipient@example.com',
      recipientAddress: '台北市測試路 1 號',
    });

    expect(orderRes.status).toBe(400);
    expect(orderRes.body).toHaveProperty('data', null);
    expect(orderRes.body.error).toBe('CART_EMPTY');

    const ordersCountAfter = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    expect(ordersCountAfter).toBe(ordersCountBefore);
  });
});
