import { useState, useEffect } from "react";
import { getCurrentUserAction } from "~/server/auth";

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return {
    user,
    loading,
    error,
    mutate: fetchUser,
  };
}
