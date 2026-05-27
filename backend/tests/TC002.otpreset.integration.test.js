import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';

const supabaseConfig = require('../config/supabase.js');
const limitersConfig = require('../config/limiters.js');

const mockFrom = vi.fn();
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();

supabaseConfig.supabaseAdmin.from = mockFrom;
supabaseConfig.supabaseAdmin.auth.admin.listUsers = mockListUsers;
supabaseConfig.supabaseAdmin.auth.admin.updateUserById = mockUpdateUserById;

limitersConfig.authLimiter = (req, res, next) => next();
limitersConfig.otpLimiter = (req, res, next) => next();
limitersConfig.uploadLimiter = (req, res, next) => next();

const createSelectResponse = (result) => {
  const query = {
    single: vi.fn().mockResolvedValueOnce(result),
  };
  query.eq = vi.fn().mockImplementation(() => query);
  const select = vi.fn().mockReturnValueOnce(query);
  return { select };
};

const createUpdateResponse = (result) => {
  const query = {
    eq: vi.fn().mockResolvedValueOnce(result),
  };
  query.update = vi.fn().mockReturnValueOnce(query);
  return { update: query.update };
};

const createDeleteResponse = (result) => {
  const query = {
    eq: vi.fn().mockResolvedValueOnce(result),
  };
  query.delete = vi.fn().mockReturnValueOnce(query);
  return { delete: query.delete };
};

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

describe('OTP reset routes integration', () => {
  describe('/api/send-otp', () => {
    it('inserts a 6-digit OTP and returns success + devOtp in dev mode', async () => {
      mockFrom.mockReturnValueOnce(
        createSelectResponse({
          data: { personal_email: 'jane.personal@example.com', name: 'Jane Doe' },
          error: null,
        }),
      );
      mockFrom.mockReturnValueOnce(
        createDeleteResponse({ error: null }),
      );
      const insert = vi.fn().mockResolvedValueOnce({ error: null });
      mockFrom.mockReturnValueOnce({ insert });

      const response = await fetch(`${baseUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane.personal@example.com' }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(expect.objectContaining({ success: true }));
      expect(body.devOtp).toMatch(/^\d{6}$/);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'employees');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'otp_tokens');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'otp_tokens');
      expect(insert).toHaveBeenCalled();
    });

    it('returns success true without devOtp when personal_email is not found', async () => {
      mockFrom.mockReturnValueOnce(
        createSelectResponse({ data: null, error: null }),
      );

      const response = await fetch(`${baseUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com' }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith('employees');
    });
  });

  describe('/api/verify-otp', () => {
    it('marks the OTP as used and returns a resetToken for a valid OTP', async () => {
      mockFrom.mockReturnValueOnce(
        createSelectResponse({
          data: {
            id: 'token-1',
            email: 'jane.personal@example.com',
            otp: '654321',
            used: false,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
          error: null,
        }),
      );
      mockFrom.mockReturnValueOnce(
        createUpdateResponse({ error: null }),
      );
      const insert = vi.fn().mockResolvedValueOnce({ error: null });
      mockFrom.mockReturnValueOnce({ insert });

      const response = await fetch(`${baseUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane.personal@example.com', otp: '654321' }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.resetToken).toMatch(/^[0-9a-f]{96}$/);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'otp_tokens');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'otp_tokens');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'otp_tokens');
      expect(insert).toHaveBeenCalled();
    });

    it('returns HTTP 400 when the OTP does not match', async () => {
      mockFrom.mockReturnValueOnce(
        createSelectResponse({ data: null, error: null }),
      );

      const response = await fetch(`${baseUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane.personal@example.com', otp: '000000' }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid OTP.' });
    });
  });

  describe('/api/reset-password', () => {
    it('updates the user password and returns success when resetToken is valid', async () => {
      mockFrom.mockReturnValueOnce(
        createSelectResponse({
          data: {
            id: 'token-1',
            email: 'jane.personal@example.com',
            otp: 'reset-token-abc',
            used: false,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
          error: null,
        }),
      );
      mockListUsers.mockResolvedValueOnce({ data: { users: [{ id: 'user-1', email: 'jane.personal@example.com' }] }, error: null });
      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockFrom.mockReturnValueOnce(
        createUpdateResponse({ error: null }),
      );

      const response = await fetch(`${baseUrl}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane.personal@example.com', resetToken: 'reset-token-abc', password: 'newStrongPassword1' }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockListUsers).toHaveBeenCalled();
      expect(mockUpdateUserById).toHaveBeenCalledWith('user-1', { password: 'newStrongPassword1' });
    });
  });
});