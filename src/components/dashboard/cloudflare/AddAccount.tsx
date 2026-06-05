"use client";

import { useState } from "react";
import { addCloudflareAccount, editCloudflareAccount } from "~/server/cloudflare";
import { ModalShell, FormActions, inputCls, monoCls, labelCls, sectionLabelCls } from "../ui/shared";

export function AddAccount({
    onClose,
    onRefresh,
    account,
}: {
    onClose: () => void;
    onRefresh?: () => void;
    account?: any;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToken, setShowToken] = useState(false);

    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const label = formData.get("label") as string;
        const cfAccountId = formData.get("cfAccountId") as string;
        const cfApiToken = formData.get("cfApiToken") as string;

        const result = account
            ? await editCloudflareAccount(account.id, label, cfAccountId, cfApiToken || undefined)
            : await addCloudflareAccount(label, cfAccountId, cfApiToken);

        setIsSubmitting(false);
        if (result?.error) {
            setError(result.error);
        } else {
            onClose();
            if (onRefresh) onRefresh();
        }
    };

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-orange-100"
            title={account ? "Edit Cloudflare Account" : "Connect Cloudflare Account"}
            subtitle={account ? "Update account labels or credentials" : "Credentials are shared across all zones in this account"}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                    <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                </svg>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                <div className="rounded-md border border-blue-100 bg-blue-50 overflow-hidden transition-all duration-300">
                    <button
                        type="button"
                        onClick={() => setIsHelpOpen(!isHelpOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-100/40 hover:bg-blue-100/60 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <p className="text-xs font-bold text-blue-800">API Token Permission Guide</p>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`text-blue-600 transition-transform duration-200 ${isHelpOpen ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {isHelpOpen && (
                        <div className="px-4 pb-4 pt-3.5 space-y-3.5 border-t border-blue-100/40">
                            <ol className="text-xs text-blue-700 space-y-1.5 pl-1 list-none">
                                <li className="flex gap-2">
                                    <span className="font-bold flex-shrink-0">1.</span>
                                    <span>Go to <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-blue-900 font-bold">Cloudflare → Profile → API Tokens</a></span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold flex-shrink-0">2.</span>
                                    <span>Click <strong>Create Token</strong> → <strong>Create Custom Token</strong> → Get started</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold flex-shrink-0">3.</span>
                                    <span>Grant the following specific permissions:</span>
                                </li>
                            </ol>
                            
                             <div className="space-y-3">
                                {/* Base Required Permission */}
                                <div className="bg-white border border-blue-100 rounded-lg p-3 space-y-2 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 animate-pulse" />
                                        <span className="text-xs text-slate-900 font-bold">1. Base Required Permission (All Features)</span>
                                    </div>
                                    <div className="pl-4">
                                        <p className="text-[11px] text-slate-700 font-medium">
                                            Scope: <strong className="font-semibold text-slate-900">Zone</strong> → Analytics → <span className="font-black text-indigo-600 underline">Read</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                                            Required to load your zones, display graphs, and monitor incoming traffic statistics.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature-specific Permissions */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">2. Additional Permissions per Rule/Feature</p>
                                    
                                    <div className="grid grid-cols-1 gap-2.5">
                                        {/* IP Block / Auto-Ban */}
                                        <div className="bg-white border border-slate-100 rounded-lg p-2.5 space-y-1 shadow-sm">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-900 font-bold">IP Auto-Ban & Blocking Rules:</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 leading-normal pl-1">
                                                Requires <strong className="text-slate-800">Account</strong> ➔ Account Filter Lists ➔ <span className="font-bold text-indigo-600 underline">Edit</span>.
                                                <span className="block text-[10px] text-slate-400 mt-0.5">Used to dynamically append offending IPs to your Cloudflare lists.</span>
                                            </p>
                                        </div>

                                        {/* Under Attack Mode */}
                                        <div className="bg-white border border-slate-100 rounded-lg p-2.5 space-y-1 shadow-sm">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-900 font-bold">Under Attack Mode Toggles:</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 leading-normal pl-1">
                                                Requires <strong className="text-slate-800">Zone</strong> ➔ Zone Settings ➔ <span className="font-bold text-indigo-600 underline">Edit</span>.
                                                <span className="block text-[10px] text-slate-400 mt-0.5">Used to dynamically enable Under Attack Mode when traffic spikes occur.</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-[11px] text-blue-600 pl-1 leading-relaxed">
                                Scope the resources to your specific Account and Zone(s) to guarantee token security, then paste it below.
                            </p>
                        </div>
                    )}
                </div>

                <div>
                    <p className={sectionLabelCls}>Identity</p>
                    <label className={labelCls}>Label <span className="text-rose-500">*</span></label>
                    <input type="text" name="label" defaultValue={account?.label} placeholder='e.g. "Production Account"' required className={inputCls} />
                </div>

                <div>
                    <p className={sectionLabelCls}>Cloudflare Credentials</p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Account ID <span className="text-rose-500">*</span></label>
                            <input type="text" name="cfAccountId" defaultValue={account?.cfAccountId} placeholder="a1b2c3d4e5f6..." required className={monoCls} />
                            <p className="mt-1 text-xs text-black font-medium opacity-80">Found in Cloudflare dashboard → right sidebar under <span className="font-mono">Account ID</span>.</p>
                        </div>
                        <div>
                            <label className={labelCls}>API Token {account ? "" : <span className="text-rose-500">*</span>}</label>
                            <div className="relative mt-1">
                                <input
                                    type={showToken ? "text" : "password"}
                                    name="cfApiToken"
                                    defaultValue={account?.cfApiToken || ""}
                                    placeholder={account ? "Enter new API token to update, or verify current below..." : "Paste your custom API token..."}
                                    required={!account}
                                    className={`${monoCls} pr-10`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken(!showToken)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showToken ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mx-6 -mt-1 flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md px-4 py-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p className="text-xs font-semibold leading-relaxed">{error}</p>
                    </div>
                )}

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={account ? "Save Changes" : "Connect Account"} />
            </form>
        </ModalShell>
    );
}
