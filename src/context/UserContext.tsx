"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUserAction, logoutAction } from "~/server/auth";

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AuthMode = "login" | "register";

interface AuthModalState {
  isOpen: boolean;
  mode: AuthMode;
  targetPath?: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  authModal: AuthModalState;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openLogin: (targetPath?: string) => void;
  openRegister: (targetPath?: string) => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<AuthModalState>({
    isOpen: false,
    mode: "login",
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await getCurrentUserAction();
      if (res.success && res.user) {
        setUser(res.user as User);
        setError(null);
      } else {
        setUser(null);
        setError(res.error || "Not authenticated");
      }
    } catch (err: any) {
      setUser(null);
      setError(err?.message || "Failed to fetch user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const openLogin = (targetPath?: string) => {
    setAuthModal({ isOpen: true, mode: "login", targetPath });
  };

  const openRegister = (targetPath?: string) => {
    setAuthModal({ isOpen: true, mode: "register", targetPath });
  };

  const closeAuthModal = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  };

  const setAuthMode = (mode: AuthMode) => {
    setAuthModal((prev) => ({ ...prev, mode }));
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logoutAction();
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        authModal,
        isSidebarOpen,
        setIsSidebarOpen,
        openLogin,
        openRegister,
        closeAuthModal,
        setAuthMode,
        logout: handleLogout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
