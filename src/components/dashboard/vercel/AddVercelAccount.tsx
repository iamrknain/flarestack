"use client";

import { useState } from "react";
import { addVercelAccount, editVercelAccount } from "~/server/vercel";
import { ModalShell, FormActions, inputCls, monoCls, labelCls, sectionLabelCls } from "../ui/shared";

export function AddVercelAccount({
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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const label = formData.get("label") as string;
        const vercelToken = formData.get("vercelToken") as string;
        const vercelTeamId = formData.get("vercelTeamId") as string || null;

        const result = account
            ? await editVercelAccount(account.id, label, vercelToken || undefined, vercelTeamId)
            : await addVercelAccount(label, vercelToken, vercelTeamId);

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
            iconBg="bg-indigo-100"
            title={account ? "Edit Vercel Account/Team" : "Connect Vercel Account/Team"}
            subtitle={account ? "Update account labels or credentials" : "Credentials are used to read and manage multiple Vercel projects"}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <polygon points="12 2 2 22 22 22" />
                </svg>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3.5 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 flex-shrink-0">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <p className="text-xs font-semibold text-blue-700">How to retrieve your Vercel Token</p>
                    </div>
                    <p className="text-xs text-blue-700">
                        Go to <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-blue-900">Vercel Account Settings → Tokens</a> and create a token. If managing projects inside a Team, you can provide the Team ID found in your Vercel team dashboard settings.
                    </p>
                </div>

                <div>
                    <p className={sectionLabelCls}>Identity</p>
                    <label className={labelCls}>Label <span className="text-rose-500">*</span></label>
                    <input type="text" name="label" defaultValue={account?.label} placeholder='e.g. "Personal Account" or "Company Team"' required className={inputCls} />
                </div>

                <div>
                    <p className={sectionLabelCls}>Vercel Credentials</p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>API Token {account ? "" : <span className="text-rose-500">*</span>}</label>
                            <div className="relative mt-1">
                                <input
                                    type={showToken ? "text" : "password"}
                                    name="vercelToken"
                                    defaultValue={account?.vercelToken || ""}
                                    placeholder={account ? "Enter new API token to update, or verify current below..." : "Paste your Vercel API token..."}
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
                        <div>
                            <label className={labelCls}>Team ID <span className="text-slate-400">(Optional if personal account)</span></label>
                            <input type="text" name="vercelTeamId" defaultValue={account?.vercelTeamId || ""} placeholder="team_xxxxxxx" className={monoCls} />
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
