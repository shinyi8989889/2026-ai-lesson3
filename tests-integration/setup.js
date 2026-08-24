// 必須在 require('../app') 之前設定，讓 src/database.js 使用獨立的記憶體資料庫，
// 完全不會碰到專案根目錄的 database.sqlite。
process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');
const db = require('../src/database');

async function registerUser(overrides = {}) {
  const email = overrides.email || `it-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: overrides.password || 'password123',
      name: overrides.name || '整合測試使用者',
    });
  return { token: res.body.data.token, user: res.body.data.user };
}

module.exports = { app, request, db, registerUser };
