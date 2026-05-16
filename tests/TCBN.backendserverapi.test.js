// backend/__tests__/server.test.js
// Owner: Ethan Dale B. Dosdos | Branch: feature/backend-api
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockAuthAdmin = {
  listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
  createUser: vi.fn().mockResolvedValue({ data: null, error: null }),
  deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateUserById: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockFiles = {
  list: vi.fn().mockResolvedValue({ data: { files: [] } }),
  create: vi.fn().mockResolvedValue({ data: { id: 'folder-id' } }),
  update: vi.fn().mockResolvedValue({}),
};

const supabaseMock = {
  from: vi.fn(() => supabaseMock),
  select: vi.fn(() => supabaseMock),
  insert: vi.fn(() => supabaseMock),
  update: vi.fn(() => supabaseMock),
  eq: vi.fn(() => supabaseMock),
  single: mockSingle,
  auth: { admin: mockAuthAdmin },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => supabaseMock,
}));

const googleMock = {
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
      })),
    },
    drive: vi.fn().mockReturnValue({ files: mockFiles }),
  },
};

globalThis.__TEST_SUPABASE_ADMIN__ = supabaseMock;
globalThis.__TEST_GOOGLEAPIS__ = googleMock;

vi.mock('googleapis', () => googleMock);

const app = (await import('../backend/server.js')).default;

describe('Backend server API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.list.mockResolvedValue({ data: { files: [] } });
    mockFiles.create.mockResolvedValue({ data: { id: 'folder-id' } });
  });

  test('TC-BN-01: GET /api/health returns 200 with service info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('MPDO Alubijid Backend');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.timestamp).toBeDefined();
  });

  test('TC-BN-02: GET /api/ping returns pong by default', async () => {
    delete process.env.PING_MESSAGE;
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('pong');
  });

  test('TC-BN-02b: GET /api/ping uses PING_MESSAGE env var', async () => {
    process.env.PING_MESSAGE = 'hello-mpdo';
    const res = await request(app).get('/api/ping');
    expect(res.body.message).toBe('hello-mpdo');
    delete process.env.PING_MESSAGE;
  });

  test('TC-BN-03: should return valid:true for registered email', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: '1', name: 'Ana Gonzales', department: 'Planning' },
      error: null,
    });

    const res = await request(app)
      .post('/api/check-email')
      .send({ email: 'ana@alubijid.gov.ph' });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.name).toBe('Ana Gonzales');
  });

  test('TC-BN-03b: should return valid:false for unregistered email', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const res = await request(app)
      .post('/api/check-email')
      .send({ email: 'nobody@example.com' });

    expect(res.body.valid).toBe(false);
  });

  test('TC-BN-04: should return 400 when email is missing', async () => {
    const res = await request(app).post('/api/check-email').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email required');
  });

  test('TC-BN-05: should archive document and return success — Happy Path', async () => {
    supabaseMock.update.mockReturnValueOnce({
      eq: vi.fn(() => ({ error: null })),
    });

    const res = await request(app)
      .post('/api/archive-document')
      .send({ documentId: 'DTN-2026-0001', archivedDate: '2026-05-11T00:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC-BN-05b: should return 400 when documentId missing � Sad Path', async () => {
    const res = await request(app).post('/api/archive-document').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('documentId required');
  });
});