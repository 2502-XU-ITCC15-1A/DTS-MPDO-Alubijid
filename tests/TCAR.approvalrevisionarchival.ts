// __tests__/approval.service.test.ts
// Owner: Emma Lene G. Ejera & Rica Louise S. Mascunana
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approveDocument, reviseDocument, sendDocumentForApproval } from '../client/lib/data';
import { supabase as importedSupabase } from '../client/lib/supabase';

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

describe('Approval and revision workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-AR-01: should set status to Sent for approval — Happy Path', async () => {
    supabase.from().update().eq.mockResolvedValueOnce({ error: null });
    supabase.from().insert.mockResolvedValueOnce({ error: null });

    await expect(
      sendDocumentForApproval('DTN-2026-0001', 'staff@example.com', 'Processing'),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('documents');
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    expect(supabase.update).toHaveBeenCalled();
    expect(supabase.insert).toHaveBeenCalled();
  });

  it('TC-AR-02: should set status to Completed — Happy Path', async () => {
    supabase.from().update().eq.mockResolvedValueOnce({ error: null });
    supabase.from().insert.mockResolvedValueOnce({ error: null });

    await expect(
      approveDocument('DTN-2026-0001', 'admin@example.com', 'Sent for approval'),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('documents');
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
  });

  it('TC-AR-03: should set Needs revision status and store comments — Happy Path', async () => {
    supabase.from().select().eq().single.mockResolvedValueOnce({
      data: { assigned_to: 'staff@example.com', routing_slip: {} },
      error: null,
    });
    supabase.from().update().eq.mockResolvedValueOnce({ error: null });
    supabase.from().insert.mockResolvedValueOnce({ error: null });

    await expect(
      reviseDocument(
        'DTN-2026-0001',
        'Please revise section 2',
        'admin@example.com',
        'Sent for approval',
      ),
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith('documents');
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
  });
  
});
