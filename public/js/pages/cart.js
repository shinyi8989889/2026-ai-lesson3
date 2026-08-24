const { createApp, ref, computed, onMounted } = Vue;

// 與後端 src/utils/shipping.js 規則一致，購物車頁僅預覽「宅配」門檻與運費，
// 實際運費仍依結帳頁選擇的配送方式於送出訂單時由伺服器計算。
const SHIPPING_RATES = {
  HOME_DELIVERY_BASE_FEE: 120,
  FREE_SHIPPING_THRESHOLD: 1500
};

createApp({
  setup() {
    const items = ref([]);
    const loading = ref(true);
    const confirmVisible = ref(false);
    const deleteItemId = ref('');

    const total = computed(function () {
      return items.value.reduce(function (sum, item) {
        return sum + item.product.price * item.quantity;
      }, 0);
    });

    const shippingFee = computed(function () {
      return total.value >= SHIPPING_RATES.FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATES.HOME_DELIVERY_BASE_FEE;
    });

    async function loadCart() {
      loading.value = true;
      try {
        const res = await apiFetch('/api/cart');
        items.value = res.data.items;
      } catch (e) {
        Notification.show('載入購物車失敗', 'error');
      } finally {
        loading.value = false;
      }
    }

    async function updateQuantity(itemId, qty) {
      if (qty < 1) return;
      try {
        await apiFetch('/api/cart/' + itemId, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: qty })
        });
        var item = items.value.find(function (i) { return i.id === itemId; });
        if (item) item.quantity = qty;
      } catch (e) {
        Notification.show('更新數量失敗', 'error');
      }
    }

    function confirmDelete(itemId) {
      deleteItemId.value = itemId;
      confirmVisible.value = true;
    }

    async function handleDelete() {
      confirmVisible.value = false;
      try {
        await apiFetch('/api/cart/' + deleteItemId.value, { method: 'DELETE' });
        items.value = items.value.filter(function (i) { return i.id !== deleteItemId.value; });
        Notification.show('已從購物車移除', 'success');
      } catch (e) {
        Notification.show('移除失敗', 'error');
      }
    }

    function goCheckout() {
      if (!Auth.isLoggedIn()) {
        window.location.href = '/login?redirect=/checkout';
        return;
      }
      window.location.href = '/checkout';
    }

    onMounted(function () {
      loadCart();
    });

    return {
      items, loading, total, shippingFee, confirmVisible,
      updateQuantity, confirmDelete, handleDelete, goCheckout
    };
  }
}).mount('#app');
