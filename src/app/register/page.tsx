"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "~/components/Logo";
import { registerAction } from "~/server/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);

      const res = await registerAction(formData);
      if (res.error) {
        throw new Error(res.error);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center bg-[#FAFAFA] text-slate-900 font-sans selection:bg-orange-100 selection:text-orange-900 w-full px-4 py-10 min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[#FAFAFA]" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 opacity-[0.4]" 
           style={{ backgroundImage: 'linear-gradient(to right, #E5E7EB 1px, transparent 1px), linear-gradient(to bottom, #E5E7EB 1px, transparent 1px)', backgroundSize: '6rem 6rem' }} />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Return to Home
          </Link>
        </div>

        <div className="bg-white border-[3px] border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-8 sm:p-10 mb-6">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-5">
              <Logo variant="icon" size={48} animate={false} />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Register
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-2 text-center">
              Create your admin credentials to get started.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-orange-50 border-2 border-orange-500 text-orange-800 text-xs font-black px-4 py-3 rounded-none mb-4 text-center uppercase tracking-wide">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Admin Name"
                required
                className="w-full bg-slate-50 border-2 border-slate-900 rounded-none px-4 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full bg-slate-50 border-2 border-slate-900 rounded-none px-4 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-50 border-2 border-slate-900 rounded-none px-4 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full bg-orange-500 text-slate-950 text-sm font-black border-2 border-slate-950 h-12 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-1.5 active:shadow-none transition-all uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Registering..." : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm font-semibold text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-orange-600 font-black hover:underline ml-1"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
