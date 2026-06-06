"use client";

import { useState } from "react";
import { generateCronToken } from "~/server/cron";
import { glassCls } from "~/components/dashboard/ui/shared";

const EXPIRY_OPTIONS = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "1 year", value: 365 },
];

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

export default function CronTokenGenerator() {
    const [expiryDays, setExpiryDays] = useState(30);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setToken(null);
        const result = await generateCronToken(expiryDays);
        setLoading(false);
        if ("error" in result) {
            alert(result.error);
        } else {
            setToken(result.token);
        }
    };

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const curlCmd = (path: string) =>
        `curl -X POST ${BASE_URL}/api/cron/${path} \\\n  -H "Authorization: Bearer ${token}"`;

    return (
        <section className={`${glassCls} overflow-hidden shadow-sm`}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-1 h-3 bg-violet-500 rounded-full" />
                    <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Cron API Token</h2>
                </div>
            </div>

            <div className="p-6 flex flex-col gap-6">
                <p className="text-xs text-slate-500 leading-relaxed">
                    Generate an authorization token to authenticate cron automation triggers against{" "}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-700">/api/cron/cloudflare</code>{" "}
                    and{" "}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-700">/api/cron/vercel</code>.
                </p>

                {/* Expiry selector + generate button */}
                <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Expires in</span>
                        <div className="flex gap-1.5 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
                            {EXPIRY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setExpiryDays(opt.value)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                                        expiryDays === opt.value
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Generating…
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>
                                </svg>
                                Generate Token
                            </>
                        )}
                    </button>
                </div>

                {/* Token output */}
                {token && (
                    <div className="flex flex-col gap-5 pt-2 border-t border-slate-100">
                        {/* Warning Alert */}
                        <div className="bg-amber-50/50 border border-amber-200/70 p-4 rounded-lg flex items-start gap-3">
                            <svg className="text-amber-600 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-amber-800">Keep this token secure!</p>
                                <p className="text-[11px] text-amber-700/90 mt-0.5 leading-relaxed">It provides full cron access to your project. This token will only be shown once and will expire in {expiryDays} days.</p>
                            </div>
                        </div>

                        {/* Raw token */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 relative group shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                    Security Token
                                </span>
                                <button
                                    onClick={() => copy(token, "token")}
                                    className="text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700/30 flex items-center gap-1"
                                >
                                    {copied === "token" ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Copied!
                                        </>
                                    ) : (
                                        "Copy"
                                    )}
                                </button>
                            </div>
                            <code className="text-[10px] text-emerald-400 font-mono break-all leading-relaxed block select-all">{token}</code>
                        </div>

                        {/* curl commands */}
                        {(["cloudflare", "vercel"] as const).map((provider) => (
                            <div key={provider} className="bg-slate-900 border border-slate-800 rounded-lg p-4 relative group shadow-inner">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        {provider === "cloudflare" ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                                    <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.04-1.24.11a4.5 4.5 0 0 0-8.87-.22c-.22-.05-.44-.08-.66-.08-2.5 0-4.5 2-4.5 4.5S4 20 6.5 20h11" />
                                                </svg>
                                                Cloudflare Cron
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                                    <polygon points="12 2 2 22 22 22" />
                                                </svg>
                                                Vercel Cron
                                            </>
                                        )}
                                    </span>
                                    <button
                                        onClick={() => copy(curlCmd(provider), provider)}
                                        className="text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700/30 flex items-center gap-1"
                                    >
                                        {copied === provider ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                Copied!
                                            </>
                                        ) : (
                                            "Copy"
                                        )}
                                    </button>
                                </div>
                                <pre className="text-[10px] text-sky-400 font-mono whitespace-pre-wrap leading-relaxed block overflow-x-auto select-all">
                                    {curlCmd(provider)}
                                </pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
