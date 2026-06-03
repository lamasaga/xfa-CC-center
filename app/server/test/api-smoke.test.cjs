'use strict';

/**
 * API 冒烟测试：独立临时 SQLite，不污染开发库。
 * 运行（在 app 目录）：npm run test:api
 */
const { test, before, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');

const dbFile = path.join(os.tmpdir(), `alevel-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);

function rmDbFiles(f) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(f + suffix);
    } catch {
      // ignore
    }
  }
}

describe('API smoke', () => {
  /** @type {import('express').Application} */
  let app;

  before(async () => {
    rmDbFiles(dbFile);
    process.env.SQLITE_PATH = dbFile;
    process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long!!';
    process.env.NODE_ENV = 'test';
    process.env.METRICS_TOKEN = 'test-metrics-secret';
    delete process.env.SENTRY_DSN;

    const dbPath = require.resolve('../db.js');
    const indexPath = require.resolve('../index.js');
    delete require.cache[dbPath];
    delete require.cache[indexPath];

    const { initDb } = require('../db.js');
    await initDb();
    ({ app } = require('../index.js'));
  });

  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health').expect(200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.db, true);
    assert.ok(res.headers['x-request-id']);
  });

  test('GET /api/metrics with wrong token', async () => {
    const res = await request(app).get('/api/metrics').set('X-Metrics-Token', 'wrong').expect(401);
    assert.ok(res.body.error);
  });

  test('GET /api/metrics with token', async () => {
    const res = await request(app)
      .get('/api/metrics')
      .set('X-Metrics-Token', 'test-metrics-secret')
      .expect(200);
    assert.ok(typeof res.body.requests_total === 'number');
    assert.ok(res.body.by_route);
  });

  test('POST /api/auth/login (seed admin)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'admin');
  });

  test('GET unknown API returns JSON 404', async () => {
    const res = await request(app).get('/api/no-such-route-ever').expect(404);
    assert.strictEqual(res.body.error, 'API route not found');
  });
});
