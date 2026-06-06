"use client";

import { usePathname } from "next/navigation";
import { useUserContext } from "~/context/UserContext";
import { useEffect } from "react";

export function ProtectedArea({ children }: { children: React.ReactNode }) {
  const { user, loading, openLogin, authModal } = useUserContext();
  const pathname = usePathname();

  const isDashboardRoute = pathname?.startsWith("/dashboard") || false;

  useEffect(() => {
    if (isDashboardRoute && !loading && !user && !authModal.isOpen) {
      openLogin(pathname);
    }
  }, [isDashboardRoute, user, loading, pathname, openLogin, authModal.isOpen]);

  if (isDashboardRoute) {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[400px] w-full">
          <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center w-full">
          <div className="w-16 h-16 bg-orange-50 border-2 border-orange-500 flex items-center justify-center mb-4 text-orange-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Authentication Required</h3>
          <p className="text-sm font-semibold text-slate-500 mt-2 max-w-sm">
            Please sign in to access the security dashboard and real-time WAF telemetry.
          </p>
          <button
            onClick={() => openLogin(pathname)}
            className="mt-6 bg-orange-500 text-slate-950 text-xs font-black border-2 border-slate-950 px-6 h-10 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-1.5 active:shadow-none transition-all uppercase tracking-widest"
          >
            Sign In
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
}
