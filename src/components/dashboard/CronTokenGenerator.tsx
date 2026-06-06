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
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2">
                <span className="w-1 h-3 bg-violet-500 rounded-full" />
                <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Cron API Token</h2>
            </div>

            <div className="p-6 flex flex-col gap-5">
                <p className="text-[12px] text-slate-500 leading-relaxed">
                    Generate a signed token to authenticate automated cron calls to{" "}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700">/api/cron/cloudflare</code>{" "}
                    and{" "}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700">/api/cron/vercel</code>.
                    The same session token from your browser cookie also works if you trigger it manually.
                </p>

                {/* Expiry selector + generate button */}
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Expires in</span>
                    <div className="flex gap-1.5">
                        {EXPIRY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setExpiryDays(opt.value)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wide border transition-all ${
                                    expiryDays === opt.value
                                        ? "bg-violet-600 text-white border-violet-600"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-violet-300"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="ml-auto bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-black px-4 py-2 rounded-md uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        {loading ? "Generating…" : "Generate Token"}
                    </button>
                </div>

                {/* Token output */}
                {token && (
                    <div className="flex flex-col gap-4">
                        {/* Raw token */}
                        <div className="bg-slate-950 rounded-lg p-4 relative group">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Token</p>
                            <code className="text-[11px] text-emerald-400 font-mono break-all leading-relaxed">{token}</code>
                            <button
                                onClick={() => copy(token, "token")}
                                className="absolute top-3 right-3 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wide px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-all"
                            >
                                {copied === "token" ? "Copied!" : "Copy"}
                            </button>
                        </div>

                        {/* curl commands */}
                        {(["cloudflare", "vercel"] as const).map((provider) => (
                            <div key={provider} className="bg-slate-950 rounded-lg p-4 relative">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    {provider === "cloudflare" ? "◇ Cloudflare" : "△ Vercel"} cron command
                                </p>
                                <pre className="text-[11px] text-sky-400 font-mono whitespace-pre-wrap leading-relaxed">
                                    {curlCmd(provider)}
                                </pre>
                                <button
                                    onClick={() => copy(curlCmd(provider), provider)}
                                    className="absolute top-3 right-3 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wide px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-all"
                                >
                                    {copied === provider ? "Copied!" : "Copy"}
                                </button>
                            </div>
                        ))}

                        <p className="text-[11px] text-amber-600 font-semibold">
                            ⚠ Keep this token secret. It provides full cron access to your account for {expiryDays} day{expiryDays !== 1 ? "s" : ""}.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
