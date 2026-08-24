// 將專案的 openapi.json 轉換為可直接匯入 Postman 的 Collection（postman/collection.json）。
// 執行流程：
//   1. 先重新執行既有的 OpenAPI 產生器（node generate-openapi.js），確保 openapi.json 為最新。
//   2. 用 openapi-to-postmanv2 轉換為 Postman Collection v2.1 JSON。
//   3. 後處理：補上 baseUrl/token/sessionId 三個 collection 變數、
//      將需要登入的請求 Bearer Token 改指向 {{token}}、
//      在登入請求加上自動存 token 的 test script、
//      為購物車相關請求補上 X-Session-Id: {{sessionId}} header。
//   4. 驗證輸出為合法 JSON 後寫入 postman/collection.json。

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const converter = require('openapi-to-postmanv2');

const ROOT = path.join(__dirname, '..');
const OPENAPI_PATH = path.join(ROOT, 'openapi.json');
const OUTPUT_DIR = path.join(ROOT, 'postman');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'collection.json');

function regenerateOpenApi() {
  console.log('[postman] 重新產生 openapi.json ...');
  execSync('node generate-openapi.js', { cwd: ROOT, stdio: 'inherit' });
}

function loadOpenApiSpec() {
  const raw = fs.readFileSync(OPENAPI_PATH, 'utf8');
  return JSON.parse(raw);
}

function convertToPostman(spec) {
  return new Promise((resolve, reject) => {
    converter.convert(
      { type: 'json', data: spec },
      { requestParametersResolution: 'Example', folderStrategy: 'Tags' },
      (err, result) => {
        if (err) return reject(err);
        if (!result || !result.result) {
          return reject(new Error((result && result.reason) || '轉換失敗，原因未知'));
        }
        resolve(result.output[0].data);
      }
    );
  });
}

// 遞迴走訪 collection 的 item 樹（item 可能是 folder，含巢狀 item 陣列）
function walkItems(items, visit) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      walkItems(item.item, visit);
    } else {
      visit(item);
    }
  }
}

function ensureCollectionVariables(collection, baseUrl) {
  collection.variable = collection.variable || [];

  const upsert = (key, value) => {
    const existing = collection.variable.find((v) => v.key === key);
    if (existing) {
      existing.value = existing.value || value;
    } else {
      collection.variable.push({ key, value, type: 'string' });
    }
  };

  upsert('baseUrl', baseUrl);
  upsert('token', '');
  upsert('sessionId', '');
}

// 把每個請求的 {{baseUrl}} 之外的 auto-generated server 變數（例如 openapi-to-postmanv2
// 有時會自動命名為 url 或其他值）統一改用 baseUrl，並確保 request.url 使用 {{baseUrl}} 前綴
function normalizeBaseUrl(collection) {
  const serverVar = collection.variable.find((v) => v.key !== 'baseUrl' && /^(url|server|host)/i.test(v.key));
  if (!serverVar) return;
  // openapi-to-postmanv2 預設就會用 baseUrl 當作變數名稱（因為 spec 只有一個 server），
  // 這裡僅為保險：若真的產生了其他命名，統一改名為 baseUrl。
  serverVar.key = 'baseUrl';
}

// Postman collection 的 url 是 { host, path, query } 結構（沒有現成的 raw 字串），
// 這裡統一組回 '/api/xxx/yyy' 形式方便比對路徑。
function requestPath(request) {
  const url = request.request && request.request.url;
  if (!url || !Array.isArray(url.path)) return '';
  return '/' + url.path.join('/');
}

function attachLoginTestScript(collection) {
  walkItems(collection.item, (request) => {
    const isLogin = requestPath(request) === '/api/auth/login' && request.request.method === 'POST';
    if (!isLogin) return;

    request.event = request.event || [];
    request.event.push({
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          'const jsonData = pm.response.json();',
          'if (jsonData && jsonData.data && jsonData.data.token) {',
          "  pm.collectionVariables.set('token', jsonData.data.token);",
          '}',
        ],
      },
    });
  });
}

function useTokenVariableForBearerAuth(collection) {
  walkItems(collection.item, (request) => {
    const auth = request.request && request.request.auth;
    if (auth && auth.type === 'bearer' && Array.isArray(auth.bearer)) {
      const tokenField = auth.bearer.find((f) => f.key === 'token');
      if (tokenField) {
        tokenField.value = '{{token}}';
      } else {
        auth.bearer.push({ key: 'token', value: '{{token}}', type: 'string' });
      }
    }
  });
}

function attachSessionIdHeader(collection) {
  walkItems(collection.item, (request) => {
    const isCartEndpoint = requestPath(request).startsWith('/api/cart');
    if (!isCartEndpoint) return;

    request.request.header = request.request.header || [];
    const hasHeader = request.request.header.some((h) => h.key === 'X-Session-Id');
    if (!hasHeader) {
      request.request.header.push({ key: 'X-Session-Id', value: '{{sessionId}}', type: 'text' });
    }
  });
}

async function main() {
  regenerateOpenApi();
  const spec = loadOpenApiSpec();
  const baseUrl = (spec.servers && spec.servers[0] && spec.servers[0].url) || 'http://localhost:3001';

  console.log('[postman] 轉換 openapi.json 為 Postman Collection ...');
  const collection = await convertToPostman(spec);

  ensureCollectionVariables(collection, baseUrl);
  normalizeBaseUrl(collection);
  attachLoginTestScript(collection);
  useTokenVariableForBearerAuth(collection);
  attachSessionIdHeader(collection);

  const output = JSON.stringify(collection, null, 2);
  // 驗證輸出確實是合法 JSON
  JSON.parse(output);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`[postman] 已產生 ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error('[postman] 產生失敗：', err);
  process.exit(1);
});
