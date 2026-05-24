import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, logout } from "../client/lib/auth.ts";

describe("Auth context helper integration", () => {
  const mockSignInWithPassword = vi.fn();
  const mockSignOut = vi.fn();
  const mockFrom = vi.fn();
  const setUser = vi.fn();

  const supabase = {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: mockFrom,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      location: {
        replace: vi.fn(),
      },
    });
  });

  it("login() should call supabase.auth.signInWithPassword and then load the employee profile", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "emp-1",
        name: "Jane Doe",
        email: "jane@example.com",
        role: "admin",
        department: "Operations",
        personal_email: "jane.personal@example.com",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValueOnce({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValueOnce({ eq: mockEq });
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const loadUserProfileFn = async (email: string) => {
      const { data, error } = await supabase.from("employees").select("*").eq("email", email).single();
      if (error || !data) return false;
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        personal_email: data.personal_email,
      });
      return true;
    };

    await login(supabase, "jane@example.com", "password123", loadUserProfileFn);

    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: "jane@example.com", password: "password123" });
    expect(mockFrom).toHaveBeenCalledWith("employees");
    expect(setUser).toHaveBeenCalledWith({
      id: "emp-1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "admin",
      department: "Operations",
      personal_email: "jane.personal@example.com",
    });
  });

  it("login() should call supabase.auth.signOut() and throw when the employee record is not found", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    const loadUserProfileFn = vi.fn().mockResolvedValueOnce(false);

    await expect(
      login(supabase, "missing@example.com", "password123", loadUserProfileFn),
    ).rejects.toThrow("Your account is not registered as an MPDO employee. Contact the administrator.");

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("logout() should call supabase.auth.signOut() and set user state to null", async () => {
    await logout(supabase, setUser as any);

    expect(mockSignOut).toHaveBeenCalled();
    expect(setUser).toHaveBeenCalledWith(null);
    expect(window.location.replace).toHaveBeenCalledWith("/login");
  });
});