const SHIPPING_METHODS = {
  HOME_DELIVERY: 'home_delivery',
  CVS: 'cvs',
};

const SHIPPING_CONFIG = {
  HOME_DELIVERY_BASE_FEE: 120,
  CVS_BASE_FEE: 60,
  FREE_SHIPPING_THRESHOLD: 1500,
  REMOTE_AREA_SURCHARGE: 200,
  URGENT_SURCHARGE: 250,
};

/**
 * 計算運費。
 *
 * 規則：
 * - 宅配（home_delivery）基本運費 120 元；商品小計達 1,500 元（含）以上免收基本運費。
 * - 超商取貨（cvs）固定收取 60 元，不屬於「基本運費」，不受滿額免運門檻影響。
 * - 偏遠地區加收 200 元，當日急件加收 250 元，兩者皆可與其他條件疊加。
 *
 * @param {object} params
 * @param {number} params.subtotal - 商品小計（不含運費），須為非負數字
 * @param {string} [params.shippingMethod] - 'home_delivery' | 'cvs'，預設 'home_delivery'
 * @param {boolean} [params.isRemote] - 是否為偏遠地區，預設 false
 * @param {boolean} [params.isUrgent] - 是否為當日急件，預設 false
 * @returns {{shippingMethod: string, baseFee: number, remoteSurcharge: number, urgentSurcharge: number, totalFee: number, freeShippingApplied: boolean}}
 */
function calculateShippingFee({
  subtotal,
  shippingMethod = SHIPPING_METHODS.HOME_DELIVERY,
  isRemote = false,
  isUrgent = false,
} = {}) {
  if (typeof subtotal !== 'number' || Number.isNaN(subtotal) || subtotal < 0) {
    throw new Error('subtotal 必須為非負數字');
  }

  if (![SHIPPING_METHODS.HOME_DELIVERY, SHIPPING_METHODS.CVS].includes(shippingMethod)) {
    throw new Error(`shippingMethod 必須為 ${SHIPPING_METHODS.HOME_DELIVERY} 或 ${SHIPPING_METHODS.CVS}`);
  }

  const isHomeDelivery = shippingMethod === SHIPPING_METHODS.HOME_DELIVERY;
  const freeShippingApplied = isHomeDelivery && subtotal >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD;

  const baseFee = isHomeDelivery
    ? (freeShippingApplied ? 0 : SHIPPING_CONFIG.HOME_DELIVERY_BASE_FEE)
    : SHIPPING_CONFIG.CVS_BASE_FEE;

  const remoteSurcharge = isRemote ? SHIPPING_CONFIG.REMOTE_AREA_SURCHARGE : 0;
  const urgentSurcharge = isUrgent ? SHIPPING_CONFIG.URGENT_SURCHARGE : 0;

  const totalFee = baseFee + remoteSurcharge + urgentSurcharge;

  return {
    shippingMethod,
    baseFee,
    remoteSurcharge,
    urgentSurcharge,
    totalFee,
    freeShippingApplied,
  };
}

module.exports = {
  calculateShippingFee,
  SHIPPING_CONFIG,
  SHIPPING_METHODS,
};
