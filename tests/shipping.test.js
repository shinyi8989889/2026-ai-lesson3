const { calculateShippingFee, SHIPPING_CONFIG, SHIPPING_METHODS } = require('../src/utils/shipping');

describe('Shipping fee calculation', () => {
  it('宅配基本運費：小計未達門檻時收取 120 元', () => {
    const result = calculateShippingFee({ subtotal: 500, shippingMethod: SHIPPING_METHODS.HOME_DELIVERY });
    expect(result.baseFee).toBe(120);
    expect(result.totalFee).toBe(120);
    expect(result.freeShippingApplied).toBe(false);
  });

  it('超商取貨費用：固定收取 60 元', () => {
    const result = calculateShippingFee({ subtotal: 500, shippingMethod: SHIPPING_METHODS.CVS });
    expect(result.baseFee).toBe(60);
    expect(result.totalFee).toBe(60);
  });

  it('商品小計 1,499 元（宅配）：未達免運門檻，仍收 120 元', () => {
    const result = calculateShippingFee({ subtotal: 1499, shippingMethod: SHIPPING_METHODS.HOME_DELIVERY });
    expect(result.baseFee).toBe(120);
    expect(result.totalFee).toBe(120);
    expect(result.freeShippingApplied).toBe(false);
  });

  it('商品小計 1,500 元（宅配）：達免運門檻，免收基本運費', () => {
    const result = calculateShippingFee({ subtotal: 1500, shippingMethod: SHIPPING_METHODS.HOME_DELIVERY });
    expect(result.baseFee).toBe(0);
    expect(result.totalFee).toBe(0);
    expect(result.freeShippingApplied).toBe(true);
  });

  it('偏遠地區附加費：疊加於宅配基本運費', () => {
    const result = calculateShippingFee({ subtotal: 500, shippingMethod: SHIPPING_METHODS.HOME_DELIVERY, isRemote: true });
    expect(result.baseFee).toBe(120);
    expect(result.remoteSurcharge).toBe(200);
    expect(result.totalFee).toBe(320);
  });

  it('當日急件附加費：疊加於宅配基本運費', () => {
    const result = calculateShippingFee({ subtotal: 500, shippingMethod: SHIPPING_METHODS.HOME_DELIVERY, isUrgent: true });
    expect(result.baseFee).toBe(120);
    expect(result.urgentSurcharge).toBe(250);
    expect(result.totalFee).toBe(370);
  });

  it('多項附加費同時成立：偏遠地區 + 當日急件（宅配未滿額）', () => {
    const result = calculateShippingFee({
      subtotal: 500,
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      isRemote: true,
      isUrgent: true,
    });
    expect(result.baseFee).toBe(120);
    expect(result.remoteSurcharge).toBe(200);
    expect(result.urgentSurcharge).toBe(250);
    expect(result.totalFee).toBe(570);
  });

  it('滿額免運與附加費同時成立：小計 1,500 元（宅配）+ 偏遠地區 + 當日急件', () => {
    const result = calculateShippingFee({
      subtotal: 1500,
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      isRemote: true,
      isUrgent: true,
    });
    expect(result.baseFee).toBe(0);
    expect(result.freeShippingApplied).toBe(true);
    expect(result.remoteSurcharge).toBe(200);
    expect(result.urgentSurcharge).toBe(250);
    expect(result.totalFee).toBe(450);
  });

  it('超商取貨 + 小計滿 1,500 元：60 元不受滿額免運門檻影響', () => {
    const result = calculateShippingFee({ subtotal: 1500, shippingMethod: SHIPPING_METHODS.CVS });
    expect(result.baseFee).toBe(60);
    expect(result.totalFee).toBe(60);
    expect(result.freeShippingApplied).toBe(false);
  });

  it('未指定 shippingMethod 時，預設為宅配', () => {
    const result = calculateShippingFee({ subtotal: 500 });
    expect(result.shippingMethod).toBe(SHIPPING_METHODS.HOME_DELIVERY);
    expect(result.baseFee).toBe(120);
  });

  it('shippingMethod 為無效值時應丟出錯誤', () => {
    expect(() => calculateShippingFee({ subtotal: 500, shippingMethod: 'teleport' })).toThrow();
  });

  it('subtotal 為負數或非數字時應丟出錯誤', () => {
    expect(() => calculateShippingFee({ subtotal: -1 })).toThrow();
    expect(() => calculateShippingFee({ subtotal: 'abc' })).toThrow();
  });

  it('SHIPPING_CONFIG 常數值應與規則一致', () => {
    expect(SHIPPING_CONFIG.HOME_DELIVERY_BASE_FEE).toBe(120);
    expect(SHIPPING_CONFIG.CVS_BASE_FEE).toBe(60);
    expect(SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD).toBe(1500);
    expect(SHIPPING_CONFIG.REMOTE_AREA_SURCHARGE).toBe(200);
    expect(SHIPPING_CONFIG.URGENT_SURCHARGE).toBe(250);
  });
});
