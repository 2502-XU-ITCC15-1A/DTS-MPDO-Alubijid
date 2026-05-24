import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createRequire } from 'module';

vi.mock('node-cron', () => ({ schedule: vi.fn() }));

const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
process.env.GOOGLE_DRIVE_FOLDER_ID ||= 'root-folder';

const mockFrom = vi.fn();
const mockDriveFiles = {
  create: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
};
const mockGetOrCreateFolderIn = vi.fn();

const supabaseConfig = require('../config/supabase.js');
supabaseConfig.supabaseAdmin.from = mockFrom;

const driveConfig = require('../config/drive.js');
const originalDrive = driveConfig.drive;
driveConfig.drive = {
  ...originalDrive,
  files: {
    ...originalDrive.files,
    ...mockDriveFiles,
  },
};

const driveHelpers = require('../utils/driveHelpers.js');
driveHelpers.getOrCreateFolderIn = mockGetOrCreateFolderIn;

const authPath = require.resolve('../middleware/auth.js');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    requireAuth: (req, res, next) => next(),
    requireAdmin: (req, res, next) => {
      if (req.headers['x-test-role'] === 'staff') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
      }
      return next();
    },
  },
};

let server;
let baseUrl;

const createSelectResponse = (result) => {
  const select = vi.fn().mockResolvedValueOnce(result);
  return { select };
};

beforeAll(async () => {
  const backupRoutes = require('../routes/backup.js');
  const app = express();
  app.use(express.json());
  app.use('/api', backupRoutes);

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

describe('Backup routes integration', () => {
  describe('POST /api/backup', () => {
    it('queries all backup tables, writes a Drive file, and returns rows counts', async () => {
      mockFrom
        .mockReturnValueOnce(createSelectResponse({ data: [{ id: 1 }], error: null }))
        .mockReturnValueOnce(createSelectResponse({ data: [{ id: 2 }, { id: 3 }], error: null }))
        .mockReturnValueOnce(createSelectResponse({ data: [], error: null }))
        .mockReturnValueOnce(createSelectResponse({ data: [{ id: 4 }], error: null }))
        .mockReturnValueOnce(createSelectResponse({ data: [{ id: 5 }, { id: 6 }, { id: 7 }], error: null }));

      mockGetOrCreateFolderIn.mockResolvedValueOnce('backup-root-id');
      mockGetOrCreateFolderIn.mockResolvedValueOnce('month-folder-id');
      mockDriveFiles.create.mockResolvedValueOnce({ data: { id: 'file-123', webViewLink: 'https://drive.google.com/file/d/file-123/view' } });
      mockDriveFiles.list.mockResolvedValueOnce({ data: { files: [] } });

      const response = await fetch(`${baseUrl}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-role': 'admin' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ success: true, fileName: expect.stringContaining('backup-'), rows: { employees: 1, documents: 2, document_files: 0, audit_logs: 1, otp_tokens: 3 } });
      expect(mockFrom).toHaveBeenCalledTimes(5);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'employees');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'documents');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'document_files');
      expect(mockFrom).toHaveBeenNthCalledWith(4, 'audit_logs');
      expect(mockFrom).toHaveBeenNthCalledWith(5, 'otp_tokens');
      expect(mockGetOrCreateFolderIn).toHaveBeenCalledWith('MPDO Backups', 'root-folder');
      expect(mockGetOrCreateFolderIn).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), 'backup-root-id');
      expect(mockDriveFiles.create).toHaveBeenCalled();
    });

    it('returns HTTP 403 when a non-admin user accesses the backup route', async () => {
      const response = await fetch(`${baseUrl}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-role': 'staff' },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Forbidden. Admin access required.' });
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockDriveFiles.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/backup/history', () => {
    it('returns a flat list of backups from the MPDO Backups folder structure', async () => {
      mockDriveFiles.list
        .mockResolvedValueOnce({ data: { files: [{ id: 'backup-root-id' }] } })
        .mockResolvedValueOnce({ data: { files: [{ id: 'month-2026-05', name: '2026-05' }, { id: 'month-2026-04', name: '2026-04' }] } })
        .mockResolvedValueOnce({ data: { files: [{ id: 'file-1', name: 'backup-2026-05-01.json', createdTime: '2026-05-01T00:00:00.000Z', size: '1234', webViewLink: 'https://drive.google.com/file/d/file-1/view' }] } })
        .mockResolvedValueOnce({ data: { files: [{ id: 'file-2', name: 'backup-2026-04-01.json', createdTime: '2026-04-01T00:00:00.000Z', size: '2345', webViewLink: 'https://drive.google.com/file/d/file-2/view' }] } });

      const response = await fetch(`${baseUrl}/api/backup/history`, {
        method: 'GET',
        headers: { 'x-test-role': 'admin' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.backups).toHaveLength(2);
      expect(body.backups).toEqual([
        {
          id: 'file-1',
          name: 'backup-2026-05-01.json',
          createdAt: '2026-05-01T00:00:00.000Z',
          size: '1234',
          url: 'https://drive.google.com/file/d/file-1/view',
          month: '2026-05',
        },
        {
          id: 'file-2',
          name: 'backup-2026-04-01.json',
          createdAt: '2026-04-01T00:00:00.000Z',
          size: '2345',
          url: 'https://drive.google.com/file/d/file-2/view',
          month: '2026-04',
        },
      ]);
      expect(mockDriveFiles.list).toHaveBeenCalledTimes(4);
    });
  });
});