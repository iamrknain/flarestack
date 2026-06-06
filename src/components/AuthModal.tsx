"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUserContext } from "~/context/UserContext";
import { Logo } from "~/components/Logo";
import { loginAction, registerAction } from "~/server/auth";

export function AuthModal() {
  const { authModal, closeAuthModal, setAuthMode, refreshUser, openLogin, openRegister } = useUserContext();
  const { isOpen, mode, targetPath } = authModal;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authParam = searchParams?.get("auth");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Trigger modal when query parameter 'auth' matches login or register
  useEffect(() => {
    if (authParam === "login") {
      if (!isOpen || mode !== "login") {
        openLogin();
      }
    } else if (authParam === "register") {
      if (!isOpen || mode !== "register") {
        openRegister();
      }
    }
  }, [authParam, isOpen, mode, openLogin, openRegister]);

  // Clear fields when modal state or mode changes
  useEffect(() => {
    setName("");
    setEmail("");
    setPassword("");
    setError("");
    setLoading(false);
  }, [isOpen, mode]);

  const handleClose = () => {
    closeAuthModal();
    // If user is currently on a protected route or has active auth query params, redirect back to clear the URL
    if (pathname.startsWith("/dashboard") || authParam) {
      router.push("/");
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      if (mode === "register") {
        formData.append("name", name);
        const res = await registerAction(formData);
        if (res.error) {
          throw new Error(res.error);
        }
      } else {
        const res = await loginAction(formData);
        if (res.error) {
          throw new Error(res.error);
        }
      }

      // Refresh the user context
      await refreshUser();
      closeAuthModal();

      // Navigate to target path if provided, else refresh/update current route
      if (targetPath) {
        router.push(targetPath);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-[420px] bg-white border-[3px] border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-8 sm:p-10 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-2 border-transparent hover:border-slate-900 transition-all rounded-none"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
            <Logo variant="icon" size={40} animate={false} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1.5 text-center">
            {mode === "login"
              ? "Access your Edge protection dashboard."
              : "Create your admin credentials to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-orange-50 border-2 border-orange-500 text-orange-800 text-xs font-black px-4 py-2 text-center uppercase tracking-wide">
              {error}
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Admin Name"
                required
                className="w-full bg-slate-50 border-2 border-slate-900 px-3 py-2 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full bg-slate-50 border-2 border-slate-900 px-3 py-2 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-50 border-2 border-slate-900 px-3 py-2 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-orange-500 text-slate-950 text-xs font-black border-2 border-slate-950 h-11 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-1.5 active:shadow-none transition-all uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading
              ? mode === "login"
                ? "Signing In..."
                : "Registering..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs font-semibold text-slate-500">
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button
                onClick={() => setAuthMode("register")}
                className="text-orange-600 font-black hover:underline focus:outline-none ml-0.5"
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setAuthMode("login")}
                className="text-orange-600 font-black hover:underline focus:outline-none ml-0.5"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
