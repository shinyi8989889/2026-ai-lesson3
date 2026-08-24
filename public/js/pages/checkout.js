const { createApp, ref, computed, onMounted } = Vue;

// 與後端 src/utils/shipping.js 規則一致，僅供結帳頁即時試算顯示用；
// 實際運費仍由伺服器於 POST /api/orders 時重新計算，此處變動須同步後端。
const SHIPPING_RATES = {
  HOME_DELIVERY_BASE_FEE: 120,
  CVS_BASE_FEE: 60,
  FREE_SHIPPING_THRESHOLD: 1500,
  REMOTE_AREA_SURCHARGE: 200,
  URGENT_SURCHARGE: 250,
};

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const loading = ref(true);
    const submitting = ref(false);
    const cartItems = ref([]);
    const form = ref({
      recipientName: '',
      recipientEmail: '',
      recipientAddress: '',
      shippingMethod: 'home_delivery',
      isRemote: false,
      isUrgent: false
    });
    const errors = ref({});

    const cartTotal = computed(function () {
      return cartItems.value.reduce(function (sum, item) {
        return sum + item.product.price * item.quantity;
      }, 0);
    });

    const shippingFee = computed(function () {
      const baseFee = form.value.shippingMethod === 'cvs'
        ? SHIPPING_RATES.CVS_BASE_FEE
        : (cartTotal.value >= SHIPPING_RATES.FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATES.HOME_DELIVERY_BASE_FEE);
      const remoteSurcharge = form.value.isRemote ? SHIPPING_RATES.REMOTE_AREA_SURCHARGE : 0;
      const urgentSurcharge = form.value.isUrgent ? SHIPPING_RATES.URGENT_SURCHARGE : 0;
      return baseFee + remoteSurcharge + urgentSurcharge;
    });

    const orderTotal = computed(function () {
      return cartTotal.value + shippingFee.value;
    });

    function validate() {
      errors.value = {};
      if (!form.value.recipientName.trim()) errors.value.recipientName = '請輸入收件人姓名';
      if (!form.value.recipientEmail.trim()) {
        errors.value.recipientEmail = '請輸入 Email';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.recipientEmail)) {
        errors.value.recipientEmail = 'Email 格式不正確';
      }
      if (!form.value.recipientAddress.trim()) errors.value.recipientAddress = '請輸入收件地址';
      return Object.keys(errors.value).length === 0;
    }

    async function submitOrder() {
      if (!validate() || submitting.value) return;
      submitting.value = true;
      try {
        const res = await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify(form.value)
        });
        Notification.show('訂單已建立，正在前往付款...', 'success');
        window.location.href = '/ecpay/payment/' + res.data.id;
      } catch (err) {
        Notification.show(err?.data?.message || '訂單建立失敗', 'error');
      } finally {
        submitting.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/cart');
        cartItems.value = res.data.items;
        if (cartItems.value.length === 0) {
          window.location.href = '/cart';
          return;
        }
      } catch (e) {
        window.location.href = '/cart';
        return;
      }
      loading.value = false;
    });

    return { loading, submitting, cartItems, form, errors, cartTotal, shippingFee, orderTotal, submitOrder };
  }
}).mount('#app');
