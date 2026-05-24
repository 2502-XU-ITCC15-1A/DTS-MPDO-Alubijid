// __tests__/approval.service.test.ts
// Owner: Emma Lene G. Ejera & Rica Louise S. Mascunana
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase as importedSupabase } from '../client/lib/supabase';

let approveDocument: typeof import('../client/lib/data').approveDocument;
let reviseDocument: typeof import('../client/lib/data').reviseDocument;
let sendDocumentForApproval: typeof import('../client/lib/data').sendDocumentForApproval;

const supabase = importedSupabase;

const createFromBuilder = () => {
  const builder: any = {};
  builder.select = vi.fn().mockReturnThis();
  builder.update = vi.fn().mockReturnThis();
  builder.insert = vi.fn().mockReturnThis();
  builder.delete = vi.fn().mockReturnThis();
  builder.eq = vi.fn().mockReturnThis();
  builder.order = vi.fn().mockReturnThis();
  builder.single = vi.fn().mockResolvedValue({ data: {}, error: null });
  return builder;
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const resetSupabaseMockImplementation = () => {
  (importedSupabase.from as any).mockReset();
  (importedSupabase.from as any).mockImplementation(() => createFromBuilder());
};

describe('Approval and revision workflow', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    resetSupabaseMockImplementation();
    const data = await import('../client/lib/data');
    approveDocument = data.approveDocument;
    reviseDocument = data.reviseDocument;
    sendDocumentForApproval = data.sendDocumentForApproval;
  });

  it('TC-APP-01: should set status to Sent for approval  Happy Path', async () => {
    const updateBuilder = createFromBuilder();
    updateBuilder.eq.mockResolvedValueOnce({ error: null });

    const insertBuilder = createFromBuilder();
    insertBuilder.insert.mockResolvedValueOnce({ error: null });

    (supabase.from as any).mockImplementationOnce(() => updateBuilder);
    (supabase.from as any).mockImplementationOnce(() => insertBuilder);

    await expect(
      sendDocumentForApproval('DTN-2026-0001', 'staff@example.com', 'Processing'),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'documents');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'audit_logs');
  });

  it('TC-APP-02: should set status to Completed  Happy Path', async () => {
    const updateBuilder = createFromBuilder();
    updateBuilder.eq.mockResolvedValueOnce({ error: null });

    const insertBuilder = createFromBuilder();
    insertBuilder.insert.mockResolvedValueOnce({ error: null });

    (supabase.from as any).mockImplementationOnce(() => updateBuilder);
    (supabase.from as any).mockImplementationOnce(() => insertBuilder);

    await expect(
      approveDocument('DTN-2026-0001', 'admin@example.com', 'Sent for approval'),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'documents');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'audit_logs');
  });

  it('TC-APP-03: should set Needs revision status and store comments  Happy Path', async () => {
    const selectBuilder = createFromBuilder();
    selectBuilder.single.mockResolvedValueOnce({
      data: { assigned_to: 'staff@example.com', routing_slip: {} },
      error: null,
    });

    const updateBuilder = createFromBuilder();
    updateBuilder.eq.mockResolvedValueOnce({ error: null });

    const insertBuilder = createFromBuilder();
    insertBuilder.insert.mockResolvedValueOnce({ error: null });

    (supabase.from as any).mockImplementationOnce(() => selectBuilder);
    (supabase.from as any).mockImplementationOnce(() => updateBuilder);
    (supabase.from as any).mockImplementationOnce(() => insertBuilder);

    await expect(
      reviseDocument(
        'DTN-2026-0001',
        'Please revise section 2',
        'admin@example.com',
        'Sent for approval',
      ),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'documents');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'documents');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'audit_logs');
  });
});
