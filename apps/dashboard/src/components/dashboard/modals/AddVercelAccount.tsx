"use client";

import { useState } from "react";
import { dashboardAction } from "~/app/dashboard/actions";
import { ModalShell, FormActions, inputCls, monoCls, labelCls, sectionLabelCls } from "../ui/shared";

export function AddVercelAccount({ onClose, onRefresh }: { onClose: () => void; onRefresh?: () => void }) {
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
            iconBg="bg-indigo-100"
            title="Connect Vercel Account/Team"
            subtitle="Credentials are used to read and manage multiple Vercel projects"
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <polygon points="12 2 2 22 22 22" />
                </svg>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                <input type="hidden" name="intent" value="add_vercel_account" />

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
                    <input type="text" name="label" placeholder='e.g. "Personal Account" or "Company Team"' required className={inputCls} />
                </div>

                <div>
                    <p className={sectionLabelCls}>Vercel Credentials</p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>API Token <span className="text-rose-500">*</span></label>
                            <input type="password" name="vercelToken" placeholder="Paste your Vercel API token..." required className={monoCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Team ID <span className="text-slate-400">(Optional if personal account)</span></label>
                            <input type="text" name="vercelTeamId" placeholder="team_xxxxxxx" className={monoCls} />
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
