import React, { createContext, useContext, useState, ReactNode } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  department?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock employee database
const mockEmployees: Record<string, { password: string; name: string; role: "admin" | "staff"; department: string }> = {
  "demo@alubijid.gov.ph": {
    password: "demo123",
    name: "demo",
    role: "admin",
    department: "Planning",
  },
  "staff@alubijid.gov.ph": {
    password: "staff123",
    name: "staff",
    role: "staff",
    department: "Planning",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = async (email: string, password: string) => {
    try {
      const employee = mockEmployees[email];
      if (!employee || employee.password !== password) {
        throw new Error("Invalid email or password");
      }

      const loggedInUser: User = {
        id: email,
        name: employee.name,
        email,
        role: employee.role,
        department: employee.department,
      };
      setUser(loggedInUser);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
