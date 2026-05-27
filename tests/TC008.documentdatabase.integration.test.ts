import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase as importedSupabase } from '../client/lib/supabase';
import {
  createDocument,
  getDocuments,
  updateDocument,
  addAuditLog,
  deleteDocument,
} from '../client/lib/data';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

const supabase = importedSupabase as unknown as {
  from: (...args: any[]) => any;
  select: any;
  insert: any;
  update: any;
  delete: any;
  eq: any;
  order: any;
  single: any;
  auth: { getSession: any };
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (global.fetch && (global.fetch as unknown as any).mockRestore) {
    (global.fetch as unknown as any).mockRestore();
  }
});

describe('Document database integration', () => {
  it('createDocument() generates a DTN, inserts a pending document, and logs two audit entries', async () => {
    supabase.insert.mockResolvedValueOnce({ error: null });
    supabase.insert.mockResolvedValueOnce({ error: null });
    supabase.insert.mockResolvedValueOnce({ error: null });

    const dtn = await createDocument(
      {
        title: 'Test Memo',
        type: 'Memorandum',
        assignedTo: 'staff@example.com',
        deadline: '2026-12-31',
        source: 'Office of Records',
        destination: 'Records Division',
      },
      [{ action: 'Review', user: 'admin@example.com' }],
      'Please review',
      'admin@example.com',
      'Staff Member',
    );

    expect(dtn).toMatch(/^DTN-\d{4}-\d{4}$/);
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'documents');
    expect(supabase.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: dtn,
        title: 'Test Memo',
        type: 'Memorandum',
        document_type: 'Received',
        status: 'Pending',
        assigned_to: 'staff@example.com',
        deadline: '2026-12-31',
        source: 'Office of Records',
        destination: 'Records Division',
        routing_slip: {
          actions: [{ action: 'Review', user: 'admin@example.com' }],
          remarks: 'Please review',
        },
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'audit_logs');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'audit_logs');
  });

  it('getDocuments() returns hydrated camelCase documents with files and history', async () => {
    const docRow = {
      id: 'DTN-2026-0001',
      title: 'Test Memo',
      type: 'Memorandum',
      document_type: 'Received',
      status: 'Pending',
      submitted_date: '2026-05-19',
      timestamp: '2026-05-19T12:00:00',
      assigned_to: 'staff@example.com',
      deadline: '2026-12-31',
      source: 'Office of Records',
      destination: 'Records Division',
      routing_slip: { actions: [], remarks: '' },
      revision_comments: 'Needs review',
      archived: false,
      created_at: '2026-05-19T12:00:00Z',
      updated_at: '2026-05-19T12:00:00Z',
    };
    const fileRow = {
      id: 'file-1',
      name: 'test.pdf',
      uploaded_at: '2026-05-19T12:10:00Z',
      uploaded_by: 'staff@example.com',
      url: 'https://example.com/test.pdf',
    };
    const auditRow = {
      action: 'Document Created',
      date: '2026-05-19T12:00:00Z',
      by_user: 'admin@example.com',
      details: 'Created document',
    };

    supabase.order.mockResolvedValueOnce({ data: [docRow], error: null });
    supabase.eq.mockResolvedValueOnce({ data: [fileRow], error: null });
    supabase.eq.mockReturnThis();
    supabase.order.mockResolvedValueOnce({ data: [auditRow], error: null });

    const documents = await getDocuments();

    expect(documents).toHaveLength(1);
    expect(documents[0]).toEqual(
      expect.objectContaining({
        id: 'DTN-2026-0001',
        title: 'Test Memo',
        type: 'Memorandum',
        documentType: 'Received',
        status: 'Pending',
        assignedTo: 'staff@example.com',
        deadline: '2026-12-31',
        source: 'Office of Records',
        destination: 'Records Division',
        revisionComments: 'Needs review',
        archived: false,
        createdAt: '2026-05-19T12:00:00Z',
        updatedAt: '2026-05-19T12:00:00Z',
      }),
    );
    expect(documents[0].files).toEqual([
      expect.objectContaining({
        id: 'file-1',
        name: 'test.pdf',
        uploadedAt: '2026-05-19T12:10:00Z',
        uploadedBy: 'staff@example.com',
        url: 'https://example.com/test.pdf',
      }),
    ]);
    expect(documents[0].history).toEqual([
      expect.objectContaining({
        action: 'Document Created',
        date: '2026-05-19T12:00:00Z',
        by: 'admin@example.com',
        details: 'Created document',
      }),
    ]);
  });

  it('updateDocument() maps assignedTo, status, deadline, and updated_at before updating', async () => {
    supabase.update.mockReturnThis();
    supabase.eq.mockResolvedValueOnce({ error: null });

    await expect(
      updateDocument('DTN-2026-0001', {
        assignedTo: 'staff@example.com',
        status: 'Processing',
        deadline: '2027-01-01',
      }),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('documents');
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        assigned_to: 'staff@example.com',
        status: 'Processing',
        deadline: '2027-01-01',
        updated_at: expect.any(String),
      }),
    );
  });

  it('addAuditLog() inserts an audit record with all required fields', async () => {
    supabase.insert.mockResolvedValueOnce({ error: null });

    await expect(addAuditLog('DTN-2026-0001', 'Document Created', 'admin@example.com', 'Created record'))
      .resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'DTN-2026-0001',
        action: 'Document Created',
        date: expect.any(String),
        by_user: 'admin@example.com',
        details: 'Created record',
      }),
    );
  });

  it('deleteDocument() calls the delete-folder endpoint first then removes related Supabase records', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    supabase.delete.mockReturnThis();
    supabase.eq.mockResolvedValueOnce({ error: null });
    supabase.eq.mockResolvedValueOnce({ error: null });
    supabase.eq.mockResolvedValueOnce({ error: null });

    await expect(deleteDocument('DTN-2026-0001')).resolves.not.toThrow();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/delete-folder/DTN-2026-0001'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'document_files');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'audit_logs');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'documents');
  });
});