const request = require('supertest');

describe('Health Check', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-jest';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-jest';
    process.env.NODE_ENV = 'test';
    // don't import full server - just the express app
    app = require('../app').app;
  });

  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('GET / returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBeDefined();
  });

  it('GET /api/v1/unknown returns 404', async () => {
    const res = await request(app).get('/api/v1/unknown-route-xyz');
    expect(res.statusCode).toBe(404);
  });
});
