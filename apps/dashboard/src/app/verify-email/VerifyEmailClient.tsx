"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '~/lib/auth-client';
import { Logo } from '~/components/Logo';

function VerifyEmailForm({ emailEnabled }: { emailEnabled: boolean }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const hasError = searchParams.get('error') === 'invalid_token';
    const isVerified = searchParams.get('verified') === 'true';
    const urlEmail = searchParams.get('email') || '';

    const { data: session } = authClient.useSession();
    const email = session?.user?.email || urlEmail;

    useEffect(() => {
        if (session?.user?.email && session.user.email !== urlEmail) {
            const params = new URLSearchParams(searchParams);
            params.set('email', session.user.email);
            router.replace(`/verify-email?${params.toString()}`);
        }
    }, [session?.user?.email]);

    useEffect(() => {
        if (isVerified) {
            const t = setTimeout(() => {
                router.push('/dashboard');
            }, 3000);
            return () => clearTimeout(t);
        }
    }, [isVerified]);

    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [resendError, setResendError] = useState('');

    useEffect(() => {
        if (resendStatus === 'sent' || resendStatus === 'error') {
            const t = setTimeout(() => setResendStatus('idle'), 7000);
            return () => clearTimeout(t);
        }
    }, [resendStatus]);

    const handleResend = async () => {
        if (!email) return;
        setResendStatus('sending');
        setResendError('');

        await authClient.sendVerificationEmail(
            { email, callbackURL: '/dashboard' },
            {
                onSuccess: () => setResendStatus('sent'),
                onError: (ctx: any) => {
                    if (ctx.error.status === 429) {
                        setResendError('Too many requests. Please wait a minute before trying again.');
                    } else {
                        setResendError(ctx.error.message || 'Failed to resend. Please try again.');
                    }
                    setResendStatus('error');
                },
            }
        );
    };

    return (
        <div className="flex flex-col items-center justify-center bg-slate-50 text-slate-900 font-sans w-full px-4 py-10 min-h-screen">
            <div className="w-full max-w-[400px]">
                {!isVerified && (
                    <div className="mb-6 flex justify-center">
                        <Link href="/auth" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            Back to Sign In
                        </Link>
                    </div>
                )}

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 sm:p-10">
                    <div className="flex flex-col items-center mb-8">
                        <div className="mb-5">
                            <Logo variant="icon" size={48} animate={false} />
                        </div>

                        {!emailEnabled ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center">
                                    Account active!
                                </h1>
                                <p className="text-sm font-medium text-slate-500 mt-2 text-center text-balance">
                                    Email verification is disabled in this environment. Your account is already active.
                                </p>
                                <Link
                                    href="/dashboard"
                                    className="w-full mt-6 bg-slate-900 text-white text-sm font-semibold rounded-xl px-4 py-3 hover:bg-black transition-all duration-200 active:scale-[0.98] shadow-sm text-center"
                                >
                                    Enter Dashboard
                                </Link>
                            </>
                        ) : isVerified ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center">
                                    Email verified!
                                </h1>
                                <p className="text-sm font-medium text-slate-500 mt-2 text-center text-balance">
                                    Your email has been successfully verified. Redirecting you to the dashboard...
                                </p>
                                <Link
                                    href="/dashboard"
                                    className="w-full mt-6 bg-slate-900 text-white text-sm font-semibold rounded-xl px-4 py-3 hover:bg-black transition-all duration-200 active:scale-[0.98] shadow-sm text-center"
                                >
                                    Go to Dashboard
                                </Link>
                            </>
                        ) : hasError ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center">
                                    Link expired or invalid
                                </h1>
                                <p className="text-sm font-medium text-slate-500 mt-2 text-center text-balance">
                                    This verification link is no longer valid.{' '}
                                    {email ? 'Request a new one below.' : 'Please sign in and request a new link.'}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                                        <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center">
                                    Check your inbox
                                </h1>
                                <p className="text-sm font-medium text-slate-500 mt-2 text-center text-balance">
                                    We sent a verification link to <strong className="text-slate-700">{email || 'your email'}</strong>.
                                    Click it to activate your account.
                                </p>
                            </>
                        )}
                    </div>

                    {/* Resend section */}
                    {email && emailEnabled && !isVerified && (
                        <div className="border-t border-slate-100 pt-6 text-center">
                            {resendStatus === 'sent' ? (
                                <p className="text-sm font-semibold text-emerald-600">
                                    ✓ New verification email sent!
                                </p>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-400 mb-3">Didn't receive it?</p>
                                    <button
                                        onClick={handleResend}
                                        disabled={resendStatus === 'sending'}
                                        className="text-sm font-bold text-slate-900 hover:underline disabled:opacity-50 transition-opacity"
                                    >
                                        {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                                    </button>
                                    {resendStatus === 'error' && (
                                        <p className="text-xs text-rose-600 mt-2">{resendError}</p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailClient({ emailEnabled }: { emailEnabled: boolean }) {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
            <VerifyEmailForm emailEnabled={emailEnabled} />
        </Suspense>
    );
}
