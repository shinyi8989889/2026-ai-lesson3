import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // 僅限 tests/ 目錄下的既有整合測試；避免誤撈 tests-unit/、tests-integration/
    // （後者會把 DATABASE_PATH 指向 :memory:，若被同一個 process 混跑會污染彼此的資料庫連線）
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    sequence: {
      files: [
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
      ],
    },
    hookTimeout: 10000,
  },
});
