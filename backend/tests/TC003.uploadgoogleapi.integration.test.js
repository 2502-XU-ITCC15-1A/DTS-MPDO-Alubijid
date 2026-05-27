import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createRequire } from 'module';

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
  update: vi.fn(),
  get: vi.fn(),
};
const mockDrivePermissionsCreate = vi.fn();
const mockGetOrCreateFolder = vi.fn();
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
  permissions: { create: mockDrivePermissionsCreate },
};

const driveHelpers = require('../utils/driveHelpers.js');
driveHelpers.getOrCreateFolder = mockGetOrCreateFolder;
driveHelpers.getOrCreateFolderIn = mockGetOrCreateFolderIn;
driveHelpers.getMonthFolderName = vi.fn().mockReturnValue('2026-05 - May 2026');
driveHelpers.sanitizeDriveQuery = vi.fn((value) => String(value).replace(/'/g, "\\'").replace(/[^\w\s.\-]/g, ''));

const authPath = require.resolve('../middleware/auth.js');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    requireAuth: (req, res, next) => next(),
    requireAdminOrHead: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
  },
};

const limiters = require('../config/limiters.js');
limiters.authLimiter = (req, res, next) => next();
limiters.otpLimiter = (req, res, next) => next();
limiters.uploadLimiter = (req, res, next) => next();

let server;
let baseUrl;

const createUpdateResponse = (result) => {
  const eq = vi.fn().mockResolvedValueOnce(result);
  const update = vi.fn().mockReturnValueOnce({ eq });
  return { update };
};

beforeAll(async () => {
  const uploadRoutes = require('../routes/upload.js');
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', uploadRoutes);

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

describe('Google Drive upload integration', () => {
  describe('/api/upload', () => {
    it('calls drive.files.create, drive.permissions.create, and returns fileId/url', async () => {
      mockGetOrCreateFolder.mockResolvedValueOnce('folder-123');
      mockDriveFiles.create.mockResolvedValueOnce({ data: { id: 'file-123', webViewLink: 'https://drive.google.com/file/d/file-123/view' } });
      mockDrivePermissionsCreate.mockResolvedValueOnce({ data: {} });

      const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({
          documentId: 'DTN-001',
          fileName: 'plan.pdf',
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('hello world').toString('base64'),
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ fileId: 'file-123', url: 'https://drive.google.com/file/d/file-123/view' });
      expect(mockGetOrCreateFolder).toHaveBeenCalledWith('DTN-001');
      expect(mockDriveFiles.create).toHaveBeenCalled();
      expect(mockDrivePermissionsCreate).toHaveBeenCalledWith({ fileId: 'file-123', requestBody: { role: 'reader', type: 'anyone' } });
    });

    it('returns HTTP 400 when the file extension is not allowed', async () => {
      const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({
          documentId: 'DTN-001',
          fileName: 'malware.exe',
          mimeType: 'application/x-msdownload',
          fileBase64: Buffer.from('bad').toString('base64'),
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'File type not allowed. Only PDF, Word, Excel, PowerPoint, and text documents are accepted.' });
      expect(mockDriveFiles.create).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 when fileBase64 decodes to more than 5MB', async () => {
      const largeBase64 = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');

      const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({
          documentId: 'DTN-001',
          fileName: 'large.pdf',
          mimeType: 'application/pdf',
          fileBase64: largeBase64,
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'File too large. Maximum size is 5MB.' });
      expect(mockDriveFiles.create).not.toHaveBeenCalled();
    });
  });

  describe('/api/delete-folder/:documentId', () => {
    it('searches Drive for the folder and deletes the found folder ID', async () => {
      mockDriveFiles.list.mockResolvedValueOnce({ data: { files: [{ id: 'folder-123' }] } });
      mockDriveFiles.delete.mockResolvedValueOnce({ data: {} });

      const response = await fetch(`${baseUrl}/api/delete-folder/DTN-001`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockDriveFiles.list).toHaveBeenCalled();
      expect(mockDriveFiles.delete).toHaveBeenCalledWith({ fileId: 'folder-123' });
    });
  });

  describe('/api/archive-document', () => {
    it('archives the document and attempts to move its Drive folder', async () => {
      mockFrom.mockReturnValueOnce(
        createUpdateResponse({ error: null }),
      );
      mockGetOrCreateFolderIn.mockResolvedValueOnce('completed-folder');
      mockGetOrCreateFolderIn.mockResolvedValueOnce('month-folder');
      mockDriveFiles.list.mockResolvedValueOnce({ data: { files: [{ id: 'doc-folder', parents: ['old-parent'] }] } });
      mockDriveFiles.update.mockResolvedValueOnce({ data: { id: 'doc-folder', parents: ['month-folder'] } });

      const response = await fetch(`${baseUrl}/api/archive-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ documentId: 'DTN-001', archivedDate: '2026-05-01T00:00:00.000Z' }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith('documents');
      expect(mockDriveFiles.update).toHaveBeenCalled();
    });
  });
});