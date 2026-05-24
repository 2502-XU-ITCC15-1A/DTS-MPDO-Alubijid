// __tests__/document.service.test.ts
// Owner: Joshua Argel B. Detchaca | Branch: feature/document-services
import { describe, it, expect, vi } from 'vitest';
import { supabase as importedSupabase } from '../client/lib/supabase';
import { createDocument, updateDocument, addAuditLog, deleteDocument } from '../client/lib/data';

// Mock Supabase so no live DB connection is needed
vi.mock('../client/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
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
};

describe('Document management', () => {
  it('TC-DOC-01: should generate DTN and insert document  Happy Path', async () => {
    // Arrange: mock insert to resolve successfully
    supabase.from().insert.mockResolvedValueOnce({ error: null });
    supabase.from().insert.mockResolvedValueOnce({ error: null }); // audit log

    // Act
    const dtn = await createDocument(
      {
        title: 'Test Doc',
        type: 'Memorandum',
        assignedTo: 'staff@example.com',
        deadline: '2026-12-31',
        source: 'Office of Records',
        destination: 'Records Division',
      },
      ['For approval/signature'],
      'For review',
      'admin@example.com',
      'Staff Member',
    );

    // Assert
    expect(dtn).toMatch(/^DTN-\d{4}-\d{4}$/);
    expect(supabase.from).toHaveBeenCalledWith('documents');
  });

  it('TC-DOC-01b: should throw when Supabase insert fails  Sad Path', async () => {
    supabase.from().insert.mockResolvedValueOnce({ error: { message: 'DB error' } });

    await expect(
      createDocument(
        {
          title: 'X',
          type: 'Memorandum',
          assignedTo: '',
          deadline: '2026-12-31',
          source: 'Office of Records',
          destination: null,
        },
        [],
        '',
        'admin@example.com',
      ),
    ).rejects.toBeTruthy();
  });

  it('TC-DOC-02: should map fields and update document  Happy Path', async () => {
    supabase.from().update().eq.mockResolvedValueOnce({ error: null });

    await expect(
      updateDocument('DTN-2026-0001', {
        status: 'Processing',
        assignedTo: 'staff@example.com',
      }),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('documents');
  });

  it('TC-DOC-03: should insert audit log entry  Happy Path', async () => {
    supabase.from().insert.mockResolvedValueOnce({ error: null });

    await expect(
      addAuditLog('DTN-2026-0001', 'Document Created', 'admin@example.com'),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
  });

  it('TC-DOC-04: should call Drive API and Supabase deletes  Happy Path', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    supabase.from().delete().eq.mockResolvedValue({ error: null });

    await expect(deleteDocument('DTN-2026-0001')).resolves.not.toThrow();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/delete-folder/DTN-2026-0001'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
