import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import express from 'express';

const require = createRequire(import.meta.url);
const mockFrom = vi.fn();
const mockCreateUser = vi.fn();

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

const supabaseConfig = require('../config/supabase.js');
supabaseConfig.supabaseAdmin.from = mockFrom;
supabaseConfig.supabaseAdmin.auth.admin.createUser = mockCreateUser;

const limiters = require('../config/limiters.js');
limiters.authLimiter = (req, res, next) => next();
limiters.otpLimiter = (req, res, next) => next();
limiters.uploadLimiter = (req, res, next) => next();

let server;
let baseUrl;

beforeAll(async () => {
  const authRoutes = require('../routes/auth.js');

  const app = express();
  app.use(express.json());
  app.use('/api', authRoutes);

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
});

const createQueryResponse = (result) => {
  const single = vi.fn().mockResolvedValueOnce(result);
  const eq = vi.fn().mockReturnValueOnce({ single });
  const select = vi.fn().mockReturnValueOnce({ eq });
  return { select };
};

describe('Auth routes integration', () => {
  describe('/api/check-email', () => {
    it('returns valid true when a registered employee email is provided', async () => {
      mockFrom.mockReturnValueOnce(
        createQueryResponse({
          data: { id: 'emp-1', name: 'Jane Doe', department: 'Planning' },
          error: null,
        }),
      );

      const response = await fetch(`${baseUrl}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane@example.com' }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        valid: true,
        name: 'Jane Doe',
        department: 'Planning',
      });
      expect(mockFrom).toHaveBeenCalledWith('employees');
    });

    it('returns valid false when the email does not exist', async () => {
      mockFrom.mockReturnValueOnce(
        createQueryResponse({
          data: null,
          error: new Error('Not found'),
        }),
      );

      const response = await fetch(`${baseUrl}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com' }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        valid: false,
        message: 'Email not registered by admin',
      });
    });

    it('returns HTTP 400 when email is missing', async () => {
      const response = await fetch(`${baseUrl}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Email required' });
    });
  });

  describe('/api/create-account', () => {
    it('returns success true for a valid registered employee and password', async () => {
      mockFrom.mockReturnValueOnce(
        createQueryResponse({
          data: { id: 'emp-1' },
          error: null,
        }),
      );
      mockCreateUser.mockResolvedValueOnce({ error: null });

      const response = await fetch(`${baseUrl}/api/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jane@example.com',
          password: 'strongPassword123',
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith('employees');
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'strongPassword123',
        email_confirm: true,
      });
    });

    it('returns HTTP 400 when password is shorter than 8 characters', async () => {
      const response = await fetch(`${baseUrl}/api/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jane@example.com',
          password: 'short',
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Password must be at least 8 characters.' });
    });

    it('returns HTTP 403 when the email is not in employees table', async () => {
      mockFrom.mockReturnValueOnce(
        createQueryResponse({
          data: null,
          error: null,
        }),
      );

      const response = await fetch(`${baseUrl}/api/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'missing@example.com',
          password: 'validPassword123',
        }),
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Email not registered by admin' });
    });
  });
});
