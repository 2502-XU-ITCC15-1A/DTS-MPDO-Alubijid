import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';

const mockJwtVerify = vi.fn();
const jose = require('jose');
const mockCreateRemoteJWKSet = vi.fn().mockReturnValue(() => {});
jose.jwtVerify = mockJwtVerify;
jose.createRemoteJWKSet = mockCreateRemoteJWKSet;

const mockFrom = vi.fn();
const supabaseConfig = require('../config/supabase.js');
supabaseConfig.supabaseAdmin.from = mockFrom;

const authMiddleware = require('../middleware/auth.js');

let server;
let baseUrl;

const createSelectResponse = (result) => {
  const single = vi.fn().mockResolvedValueOnce(result);
  const eq = vi.fn().mockReturnValueOnce({ single });
  const select = vi.fn().mockReturnValueOnce({ eq });
  return { select };
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());

  app.get('/protected', authMiddleware.requireAuth, (req, res) => {
    res.json({ ok: true, user: req.authUser });
  });

  app.get('/admin-only', authMiddleware.requireAuth, authMiddleware.requireAdmin, (req, res) => {
    res.json({ ok: true, role: req.employeeRole });
  });

  app.get('/admin-head', authMiddleware.requireAuth, authMiddleware.requireAdminOrHead, (req, res) => {
    res.json({ ok: true, role: req.employeeRole });
  });

  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockJwtVerify.mockImplementation(async (token) => {
    if (token === 'valid-admin-token') {
      return { payload: { sub: 'user-admin', email: 'admin@example.com' } };
    }
    if (token === 'valid-head-token') {
      return { payload: { sub: 'user-head', email: 'head@example.com' } };
    }
    if (token === 'valid-staff-token') {
      return { payload: { sub: 'user-staff', email: 'staff@example.com' } };
    }
    throw new Error('Invalid token');
  });
});

describe('Auth middleware integration', () => {
  it('requireAuth returns 401 when no Authorization header is present', async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized. No token provided.' });
  });

  it('requireAuth returns 401 when the JWT is invalid or expired', async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-token' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized. Invalid or expired token.' });
  });

  it("requireAdmin returns 403 when a valid JWT belongs to a user with role='staff'", async () => {
    mockFrom.mockReturnValueOnce(
      createSelectResponse({ data: { role: 'staff' }, error: null }),
    );

    const response = await fetch(`${baseUrl}/admin-only`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-staff-token' },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden. Admin access required.' });
    expect(mockFrom).toHaveBeenCalledWith('employees');
  });

  it("requireAdminOrHead returns 200 when the authenticated user has role='head_staff'", async () => {
    mockFrom.mockReturnValueOnce(
      createSelectResponse({ data: { role: 'head_staff' }, error: null }),
    );

    const response = await fetch(`${baseUrl}/admin-head`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-head-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, role: 'head_staff' });
    expect(mockFrom).toHaveBeenCalledWith('employees');
  });

  it('requireAdminOrHead returns 403 when a valid JWT belongs to a user with role=staff', async () => {
    mockFrom.mockReturnValueOnce(
      createSelectResponse({ data: { role: 'staff' }, error: null }),
    );

    const response = await fetch(`${baseUrl}/admin-head`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-staff-token' },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden. Admin or Head Staff access required.' });
    expect(mockFrom).toHaveBeenCalledWith('employees');
  });
});