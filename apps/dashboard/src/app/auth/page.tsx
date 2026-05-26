"use client";

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '~/lib/auth-client';
import { Logo } from '~/components/Logo';

function AuthForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "register");
    const [signingOut, setSigningOut] = useState(false);

    const { data: session } = authClient.useSession();

    const handleSignOut = async () => {
        setSigningOut(true);
        await authClient.signOut({ fetchOptions: { onSuccess: () => router.push('/auth') } });
        setSigningOut(false);
    };

    // Already authenticated — don't show the form
    if (session?.user) {
        return (
            <div className="flex flex-col items-center justify-center bg-slate-50 text-slate-900 font-sans w-full px-4 py-10 min-h-screen">
                <div className="w-full max-w-[400px]">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 sm:p-10">
                        <div className="flex flex-col items-center mb-8">
                            <div className="mb-5">
                                <Logo variant="icon" size={48} animate={false} />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                Already signed in
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-2 text-center text-balance">
                                You're signed in as <strong className="text-slate-700">{session.user.email}</strong>
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <Link
                                href="/dashboard"
                                className="w-full bg-slate-900 text-white text-sm font-semibold rounded-xl px-4 py-3 hover:bg-black transition-all duration-200 active:scale-[0.98] shadow-sm text-center"
                            >
                                Go to Dashboard
                            </Link>
                            <button
                                onClick={handleSignOut}
                                disabled={signingOut}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-3 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                            >
                                {signingOut ? 'Signing out...' : 'Sign Out'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (isSignUp) {
            await authClient.signUp.email(
                { email, password, name },
                {
                    onSuccess: (ctx: { data?: { user?: { emailVerified?: boolean } } }) => {
                        if (ctx.data?.user?.emailVerified === false) {
                            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
                        } else {
                            router.push('/dashboard');
                        }
                    },
                    onError: (ctx: { error: { status: number; message?: string } }) => {
                        if (ctx.error.status === 429) {
                            setError('Too many sign-up attempts. Please wait a minute and try again.');
                        } else {
                            setError(ctx.error.message || 'Sign up failed. Please try again.');
                        }
                        setLoading(false);
                    },
                }
            );
        } else {
            await authClient.signIn.email(
                { email, password },
                {
                    onSuccess: () => router.push('/dashboard'),
                    onError: (ctx: { error: { status: number; message?: string } }) => {
                        if (ctx.error.status === 403) {
                            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
                        } else if (ctx.error.status === 429) {
                            setError('Too many attempts. Please wait a minute and try again.');
                        } else {
                            setError(ctx.error.message || 'Authentication failed');
                        }
                        setLoading(false);
                    },
                }
            );
        }
    };

    return (
        <div className="flex flex-col items-center justify-center bg-slate-50 text-slate-900 font-sans selection:bg-slate-200 selection:text-slate-900 w-full px-4 py-10 relative z-0 min-h-screen">
            <div className="w-full max-w-[400px] relative z-10">
                <div className="mb-6 flex justify-center">
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Return to Home
                    </Link>
                </div>
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 sm:p-10 mb-6">
                    <div className="flex flex-col items-center mb-8">
                        <div className="mb-5">
                            <Logo variant="icon" size={48} animate={false} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                            {isSignUp ? 'Create Account' : 'Welcome back'}
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-2 text-center text-balance">
                            {isSignUp ? 'Set up your admin account to get started.' : 'Sign in to manage your Edge defenses.'}
                        </p>
                    </div>

                    <form className="space-y-4" onSubmit={handleAuth}>
                        {error && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold px-4 py-3 rounded-xl mb-4 text-center">
                                {error}
                            </div>
                        )}

                        {isSignUp && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Admin User"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 focus:bg-white transition-all duration-200"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 focus:bg-white transition-all duration-200"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Password</label>
                                {!isSignUp && <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Forgot?</a>}
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 focus:bg-white transition-all duration-200"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-6 w-full bg-slate-900 text-white text-sm font-semibold rounded-xl px-4 py-3 hover:bg-black transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Authenticating...
                                </>
                            ) : (isSignUp ? "Create Account" : "Sign In")}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm font-medium text-slate-500">
                    {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-slate-900 font-bold hover:underline transition-colors ml-1"
                    >
                        {isSignUp ? "Sign In" : "Sign Up"}
                    </button>
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <AuthForm />
    </Suspense>
  );
}
