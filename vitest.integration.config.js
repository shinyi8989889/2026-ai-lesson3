import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests-integration/**/*.test.js'],
    fileParallelism: false,
    hookTimeout: 10000,
  },
});
