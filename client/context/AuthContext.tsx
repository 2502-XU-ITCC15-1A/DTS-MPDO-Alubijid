import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { login as authLogin, logout as authLogout, loadUserProfile as authLoadUserProfile } from "@/lib/auth";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "head_staff" | "staff";
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
        await authLoadUserProfile(supabase, session.user.email, setUser);
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

  const login = async (email: string, password: string) => {
    await authLogin(supabase, email, password, async (emailToLoad) =>
      await authLoadUserProfile(supabase, emailToLoad, setUser),
    );
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
      await authLoadUserProfile(supabase, session.user.email, setUser);
    }
  };

  const logout = async () => {
    await authLogout(supabase, setUser);
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
