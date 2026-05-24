import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';

const mockFrom = vi.fn();
const mockListUsers = vi.fn();
const mockDeleteUser = vi.fn();

const supabaseConfig = require('../config/supabase.js');
supabaseConfig.supabaseAdmin.from = mockFrom;
supabaseConfig.supabaseAdmin.auth.admin.listUsers = mockListUsers;
supabaseConfig.supabaseAdmin.auth.admin.deleteUser = mockDeleteUser;

const authPath = require.resolve('../middleware/auth.js');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    requireAuth: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
  },
};

let server;
let baseUrl;

const createSelectResponse = (result) => {
  const single = vi.fn().mockResolvedValueOnce(result);
  const eq = vi.fn().mockReturnValueOnce({ single });
  const select = vi.fn().mockReturnValueOnce({ eq });
  return { select };
};

const createUpdateResponse = (result) => {
  const eq = vi.fn().mockResolvedValueOnce(result);
  const update = vi.fn().mockReturnValueOnce({ eq });
  return { update };
};

const createDeleteResponse = (result) => {
  const eq = vi.fn().mockResolvedValueOnce(result);
  const del = vi.fn().mockReturnValueOnce({ eq });
  return { delete: del };
};

const createProfileUpdateResponse = (result) => {
  const single = vi.fn().mockResolvedValueOnce(result);
  const select = vi.fn().mockReturnValueOnce({ single });
  const eq = vi.fn().mockReturnValueOnce({ select });
  const update = vi.fn().mockReturnValueOnce({ eq });
  return { update };
};

beforeAll(async () => {
  const userRoutes = require('../routes/user.js');
  const app = express();
  app.use(express.json());
  app.use('/api', userRoutes);

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

describe('Employee database integration', () => {
  describe('DELETE /api/user/delete-employee/:id', () => {
    it('calls employees.select, auth.admin.listUsers, auth.admin.deleteUser, documents.update, and employees.delete in order', async () => {
      mockFrom
        .mockReturnValueOnce(createSelectResponse({ data: { email: 'staff@example.com' }, error: null }))
        .mockReturnValueOnce(createUpdateResponse({ error: null }))
        .mockReturnValueOnce(createDeleteResponse({ error: null }));

      mockListUsers.mockResolvedValueOnce({
        data: { users: [{ id: 'auth-user-1', email: 'staff@example.com' }] },
        error: null,
      });
      mockDeleteUser.mockResolvedValueOnce({ error: null });

      const response = await fetch(`${baseUrl}/api/user/delete-employee/emp-1`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'employees');
      expect(mockListUsers).toHaveBeenCalled();
      expect(mockDeleteUser).toHaveBeenCalledWith('auth-user-1');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'documents');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'employees');
    });

    it('returns HTTP 404 with { error: "Employee not found." } when employees.select returns null or error', async () => {
      mockFrom.mockReturnValueOnce(createSelectResponse({ data: null, error: null }));

      const response = await fetch(`${baseUrl}/api/user/delete-employee/emp-2`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Employee not found.' });
      expect(mockListUsers).not.toHaveBeenCalled();
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/user/update-profile', () => {
    it('calls employees.update and returns success with the updated profile', async () => {
      const profile = {
        id: 'emp-1',
        name: 'Jane Doe',
        department: 'Operations',
        personal_email: 'jane@example.com',
      };

      mockFrom.mockReturnValueOnce(createProfileUpdateResponse({ data: profile, error: null }));

      const response = await fetch(`${baseUrl}/api/user/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'emp-1',
          name: 'Jane Doe',
          department: 'Operations',
          personal_email: 'jane@example.com',
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, profile });
      expect(mockFrom).toHaveBeenCalledWith('employees');
    });

    it('returns HTTP 400 with { error: "Employee id and name are required." } when id or name is missing from the request body', async () => {
      const response = await fetch(`${baseUrl}/api/user/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: 'Operations' }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Employee id and name are required.' });
    });
  });
});