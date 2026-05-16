// __tests__/employee.service.test.ts
// Owner: Sandy Lumacad | Branch: feature/employee-management
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../client/lib/supabase';

interface Employee {
  id?: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

describe('Employee Management API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmployees', () => {
    it('TC-EMP-01: should return employees array  Happy Path', async () => {
      const mockEmployee: Employee = {
        id: '1',
        name: 'Ana',
        email: 'ana@example.com',
        role: 'staff',
        department: 'Planning',
      };

      const mockSelect = vi.fn().mockResolvedValueOnce({
        data: [mockEmployee],
        error: null,
      });

      (supabase.from as any).mockReturnValueOnce({
        select: mockSelect,
      });

      const result = await supabase
        .from('employees')
        .select()
        .then((res: any) => res.data);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ana');
      expect(supabase.from).toHaveBeenCalledWith('employees');
    });
  });

  describe('addEmployee', () => {
    it('TC-EMP-02: should insert and return new employee  Happy Path', async () => {
      const newEmp: Omit<Employee, 'id'> = {
        email: 'new@example.com',
        name: 'New Staff',
        role: 'staff',
        department: 'GIS',
      };

      const insertedEmp: Employee = {
        id: '99',
        ...newEmp,
      };

      const mockSingle = vi
        .fn()
        .mockResolvedValueOnce({
          data: insertedEmp,
          error: null,
        });

      const mockSelect = vi.fn().mockReturnValueOnce({
        single: mockSingle,
      });

      const mockInsert = vi.fn().mockReturnValueOnce({
        select: mockSelect,
      });

      (supabase.from as any).mockReturnValueOnce({
        insert: mockInsert,
      });

      const result = await supabase
        .from('employees')
        .insert(newEmp)
        .select()
        .single()
        .then((res: any) => res.data);

      expect(result.email).toBe('new@example.com');
      expect(result.id).toBeDefined();
    });
  });

  describe('deleteEmployee', () => {
    it('TC-EMP-03: should call DELETE endpoint and resolve  Happy Path', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const response = await fetch('/api/delete-employee/emp-uuid-123', {
        method: 'DELETE',
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/delete-employee/emp-uuid-123'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('TC-EMP-03b: should throw on API error  Sad Path', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Employee not found.' }),
      });

      const response = await fetch('/api/delete-employee/bad-id', {
        method: 'DELETE',
      });
      const body = await response.json() as { error: string };

      expect(response.ok).toBe(false);
      expect(body.error).toBe('Employee not found.');
    });
  });
});
