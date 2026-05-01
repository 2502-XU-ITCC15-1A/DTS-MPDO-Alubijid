import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  department?: string;
  personal_email?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session on page load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        await loadUserProfile(session.user.email);
      }
      setIsLoading(false);
    });

    // Listen for login/logout events
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadUserProfile(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      console.error("Employee profile not found for:", email, error);
      return false;
    }

    setUser({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department,
      personal_email: data.personal_email ?? undefined,
    });
    return true;
  }

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const found = await loadUserProfile(email);
    if (!found) {
      await supabase.auth.signOut();
      throw new Error("Your account is not registered as an MPDO employee. Contact the administrator.");
    }
  };

  const refreshUserProfile = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      console.error("Failed to refresh session", error);
      return;
    }

    if (session?.user?.email) {
      await loadUserProfile(session.user.email);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
