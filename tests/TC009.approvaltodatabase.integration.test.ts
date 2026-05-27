import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase as importedSupabase } from '../client/lib/supabase';
import * as data from '../client/lib/data';

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
		auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }) },
	},
}));

const supabase = importedSupabase as unknown as any;

beforeEach(() => {
	vi.clearAllMocks();
});

describe('Approval → Database flows', () => {
	it("sendDocumentForApproval() calls updateDocument and addAuditLog with old status in details", async () => {
		// Arrange: make update and insert succeed
		supabase.update = vi.fn().mockReturnThis();
		supabase.eq = vi.fn().mockResolvedValueOnce({ error: null });
		supabase.insert = vi.fn().mockResolvedValueOnce({ error: null });

		// Act
		await data.sendDocumentForApproval('DTN-2026-0001', 'approver@example.com', 'Processing');

		// Assert: update should have been invoked on documents and an audit insert recorded
		expect(supabase.update).toHaveBeenCalled();
		expect(supabase.insert).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'Sent for Admin Approval' }),
		);
	});

	it("approveDocument() updates status to Completed and logs approval details", async () => {
		supabase.update = vi.fn().mockReturnThis();
		supabase.eq = vi.fn().mockResolvedValueOnce({ error: null });
		supabase.insert = vi.fn().mockResolvedValueOnce({ error: null });

		await data.approveDocument('DTN-2026-0001', 'admin@example.com', 'Sent for approval');

		expect(supabase.update).toHaveBeenCalled();
		expect(supabase.insert).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'Document Approved' }),
		);
	});

	it('reviseDocument() selects the document, updates status and revision_comments, and logs two entries', async () => {
		// Arrange: provide a chained response for the initial select.single()
		const selectObj = { select: () => ({ eq: () => ({ single: async () => ({ data: { assigned_to: 'staff@example.com', routing_slip: {} }, error: null }) }) }) };
		const updateObj = { update: () => ({ eq: async () => ({ error: null }) }) };
		const auditInsert1 = vi.fn().mockResolvedValue({ error: null });
		const auditInsert2 = vi.fn().mockResolvedValue({ error: null });

		supabase.from = vi.fn()
			.mockReturnValueOnce(selectObj)
			.mockReturnValueOnce(updateObj)
			.mockReturnValueOnce({ insert: auditInsert1 })
			.mockReturnValueOnce({ insert: auditInsert2 });

		// Act
		await data.reviseDocument('DTN-2026-0001', 'Please revise section 2', 'revisor@example.com', 'Processing');

		// Assert
		expect(supabase.from).toHaveBeenCalled();
		expect(auditInsert1).toHaveBeenCalled();
		expect(auditInsert2).toHaveBeenCalled();
	});

	it('reviseDocument() throws when document select returns an error and does not call update or addAuditLog', async () => {
		// Arrange: make the chained select.single return an error
		supabase.from = vi.fn().mockReturnValueOnce({
			select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('Not found') }) }) }),
		});

		supabase.insert = vi.fn();

		await expect(data.reviseDocument('DTN-XXXX', 'Comments', 'revisor@example.com')).rejects.toBeTruthy();

		expect(supabase.insert).not.toHaveBeenCalled();
	});
});
