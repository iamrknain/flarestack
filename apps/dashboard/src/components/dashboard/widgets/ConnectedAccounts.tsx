import { useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardAction } from "~/app/dashboard/actions";

export function ConnectedAccounts({ accounts, onAdd, error: initialError }: {
    accounts: any[];
    onAdd: () => void;
    error?: string;
}) {
    const router = useRouter();
    const [error, setError] = useState(initialError || "");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    if (accounts.length === 0) return null;

    const handleDelete = async (e: React.FormEvent, accountId: string, label: string) => {
        e.preventDefault();
        if (!confirm(`Remove "${label}"?\n\nAny zones using this account must be removed first.`)) {
            return;
        }
        setDeletingId(accountId);
        setError("");
        const fd = new FormData();
        fd.append("intent", "delete_account");
        fd.append("accountId", accountId);
        const res = await dashboardAction(fd);
        setDeletingId(null);
        if (res?.success) {
            router.refresh();
        } else {
            setError(res?.error || "Failed to delete account");
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="font-bold uppercase">
                    Connected Cloudflare Accounts
                </h2>
            </div>

            {error && (
                <div className="mb-4 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-bold shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                {accounts.map((account: any) => (
                    <div
                        key={account.id}
                        className="flex items-center bg-gradient-to-br from-white to-indigo-50/50 border border-indigo-100 rounded-md shadow-sm overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] flex-shrink-0" />
                            <span className="text-sm font-bold text-slate-900">{account.label}</span>
                            <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-70 ml-1">{account.cfAccountId.slice(0, 8)}…</span>
                        </div>
                        <form
                            onSubmit={(e) => handleDelete(e, account.id, account.label)}
                        >
                            <button
                                type="submit"
                                title="Remove account"
                                disabled={deletingId === account.id}
                                className="h-full px-3 py-2.5 border-l border-indigo-100/50 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                        </form>
                    </div>
                ))}

                <button
                    onClick={onAdd}
                    className="flex items-center gap-1.5 px-4 h-[42px] rounded-md text-xs font-black uppercase tracking-widest text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Cloudflare Account
                </button>
            </div>
        </div>
    );
}
