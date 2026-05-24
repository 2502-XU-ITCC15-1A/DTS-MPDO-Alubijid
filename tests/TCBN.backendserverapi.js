// backend/__tests__/server.test.js
// Owner: Ethan Dale B. Dosdos | Branch: feature/backend-api
const request = require('supertest');
const express = require('express');
// Mock Supabase and Google APIs before requiring server
jest.mock('@supabase/supabase-js', () => ({
createClient: () => ({
from: jest.fn().mockReturnThis(),
select: jest.fn().mockReturnThis(),
insert: jest.fn().mockReturnThis(),
update: jest.fn().mockReturnThis(),
eq: jest.fn().mockReturnThis(),
single: jest.fn().mockResolvedValue({ data: null, error: null }),
auth: { admin: { listUsers: jest.fn(), createUser: jest.fn(), deleteUser: jest.fn() } },
}),
}));
jest.mock('googleapis', () => ({ google: { auth: { OAuth2: jest.fn() }, drive: jest.fn() } }));
// Load server after mocks are in place
const app = require('../server'); // server.js exports app or is loadable
test('TC-API-01: GET /api/health returns 200 with service info', async () => {
const res = await request(app).get('/api/health');
expect(res.status).toBe(200);
expect(res.body.status).toBe('ok');
expect(res.body.service).toBe('MPDO Alubijid Backend');
expect(res.body.version).toBe('1.0.0');
expect(res.body.timestamp).toBeDefined();
});
test('TC-API-02: GET /api/ping returns pong by default', async () => {
delete process.env.PING_MESSAGE;
const res = await request(app).get('/api/ping');
expect(res.status).toBe(200);
expect(res.body.message).toBe('pong');
});
test('TC-API-02b: GET /api/ping uses PING_MESSAGE env var', async () => {
process.env.PING_MESSAGE = 'hello-mpdo';
const res = await request(app).get('/api/ping');
expect(res.body.message).toBe('hello-mpdo');
delete process.env.PING_MESSAGE;
});
test('TC-API-03: should return valid:true for registered email', async () => {
supabaseMock.from().select().eq().single.mockResolvedValueOnce({
data: { id: '1', name: 'Ana Gonzales', department: 'Planning' }, error: null,
});
const res = await request(app)
.post('/api/check-email')
.send({ email: 'ana@alubijid.gov.ph' });
expect(res.status).toBe(200);
expect(res.body.valid).toBe(true);
expect(res.body.name).toBe('Ana Gonzales');
});
test('TC-API-03b: should return valid:false for unregistered email', async () => {
supabaseMock.from().select().eq().single.mockResolvedValueOnce({
data: null, error: { message: 'Not found' },
});
const res = await request(app).post('/api/check-email')
.send({ email: 'nobody@example.com' });
expect(res.body.valid).toBe(false);
});
test('TC-API-04: should return 400 when email is missing', async () => {
const res = await request(app)
.post('/api/check-email')
.send({});
expect(res.status).toBe(400);
expect(res.body.error).toBe('Email required');
});
test('TC-API-05: should archive document and return success — Happy Path', async () => {
supabaseMock.from().update().eq.mockResolvedValueOnce({ error: null });
// Drive mock is already set to no-op
const res = await request(app)
.post('/api/archive-document')
.send({ documentId: 'DTN-2026-0001', archivedDate: '2026-05-11T00:00:00.000Z' });
expect(res.status).toBe(200);
expect(res.body.success).toBe(true);
});
test('TC-API-05b: should return 400 when documentId missing — Sad Path', async () => {
const res = await request(app).post('/api/archive-document').send({});
expect(res.status).toBe(400);
expect(res.body.error).toBe('documentId required');
});
