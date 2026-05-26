"use client";

import { useState } from "react";
import { dashboardAction } from "~/app/dashboard/actions";
import { ModalShell, FormActions, inputCls, monoCls, labelCls, sectionLabelCls } from "../ui/shared";

export function AddAccount({ onClose, onRefresh }: { onClose: () => void; onRefresh?: () => void }) {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const result = await dashboardAction(formData);

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
            title="Connect Cloudflare Account"
            subtitle="Credentials are shared across all zones in this account"
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                    <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                </svg>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                <input type="hidden" name="intent" value="add_account" />

                <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3.5 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 flex-shrink-0">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <p className="text-xs font-semibold text-blue-700">How to create your API token first</p>
                    </div>
                    <ol className="text-xs text-blue-700 space-y-1.5 pl-1 list-none">
                        <li className="flex gap-2">
                            <span className="font-bold flex-shrink-0">1.</span>
                            <span>Go to <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-blue-900">Cloudflare → Profile → API Tokens</a></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold flex-shrink-0">2.</span>
                            <span>Click <strong>Create Token</strong> → <strong>Create Custom Token</strong> → Get started</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold flex-shrink-0">3.</span>
                            <span>Grant exactly these two permissions:</span>
                        </li>
                    </ol>
                    <div className="ml-4 space-y-1.5">
                        <div className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="text-xs text-black font-medium"><span className="font-bold">Account</span> → Account Filter Lists → <span className="font-bold text-blue-700 underline">Edit</span></span>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="text-xs text-black font-medium"><span className="font-bold">Zone</span> → Analytics → <span className="font-bold text-blue-700 underline">Read</span></span>
                        </div>
                    </div>
                    <p className="text-xs text-blue-600 pl-1">Scope to your specific account + zones, then paste the generated token below.</p>
                </div>

                <div>
                    <p className={sectionLabelCls}>Identity</p>
                    <label className={labelCls}>Label <span className="text-rose-500">*</span></label>
                    <input type="text" name="label" placeholder='e.g. "Production Account"' required className={inputCls} />
                </div>

                <div>
                    <p className={sectionLabelCls}>Cloudflare Credentials</p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Account ID <span className="text-rose-500">*</span></label>
                            <input type="text" name="cfAccountId" placeholder="a1b2c3d4e5f6..." required className={monoCls} />
                            <p className="mt-1 text-xs text-black font-medium opacity-80">Found in Cloudflare dashboard → right sidebar under <span className="font-mono">Account ID</span>.</p>
                        </div>
                        <div>
                            <label className={labelCls}>API Token <span className="text-rose-500">*</span></label>
                            <input type="password" name="cfApiToken" placeholder="Paste your custom API token..." required className={monoCls} />
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

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Connect Account" />
            </form>
        </ModalShell>
    );
}
