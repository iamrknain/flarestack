"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getListsAction, createAddIpToListRule, editAddIpToListRule } from "~/server/cloudflare";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls, monoCls } from "../ui/shared";
import { TokenPermissionsValidator } from "./TokenPermissionsValidator";

export function AddIpToList({
    zoneId,
    onClose,
    isSubmitting: initialIsSubmitting,
    zones,
    accounts,
    rule,
}: {
    zoneId: string;
    onClose: () => void;
    isSubmitting: boolean;
    zones: any[];
    accounts: any[];
    rule?: any;
}) {
    const router = useRouter();
    const [discoveredLists, setDiscoveredLists] = useState<any[]>([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedListId, setSelectedListId] = useState(rule?.cfListId || "");
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [cfApiTokenOverride, setCfApiTokenOverride] = useState(rule?.cfApiTokenOverride || "");
    const [debouncedToken, setDebouncedToken] = useState(rule?.cfApiTokenOverride || "");
    const [showTokenOverride, setShowTokenOverride] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedToken(cfApiTokenOverride);
        }, 500);
        return () => clearTimeout(timer);
    }, [cfApiTokenOverride]);

    useEffect(() => {
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            setIsLoadingLists(true);
            getListsAction(zone.cfAccountRef, debouncedToken)
                .then(data => {
                    if (Array.isArray(data)) {
                        setDiscoveredLists(data);
                    }
                })
                .catch(err => console.error("Fetch lists error:", err))
                .finally(() => setIsLoadingLists(false));
        }
    }, [zoneId, zones, debouncedToken]);

    const selectedListName = discoveredLists.find(l => l.id === selectedListId)?.name || rule?.cfListName || "";

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const formData = new FormData(e.currentTarget);
            const name = formData.get("name") as string;
            const rateLimitThreshold = parseInt(formData.get("rateLimitThreshold") as string) || 10000;
            const windowSeconds = parseInt(formData.get("windowSeconds") as string) || 300;

            const res = rule
                ? await editAddIpToListRule(rule.id, {
                    name,
                    cfListId: selectedListId,
                    cfListName: selectedListName,
                    rateLimitThreshold,
                    windowSeconds,
                    cfApiTokenOverride: cfApiTokenOverride.trim() || null,
                })
                : await createAddIpToListRule({
                    name,
                    zoneConfigId: zoneId,
                    cfListId: selectedListId,
                    cfListName: selectedListName,
                    rateLimitThreshold,
                    windowSeconds,
                    cfApiTokenOverride: cfApiTokenOverride.trim() || null,
                });

            if (res?.success) {
                router.refresh();
                onClose();
            } else {
                setError(res?.error || "Failed to save rule");
            }
        } catch (err) {
            console.error("Save rule error:", err);
            setError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-emerald-100"
            title={rule ? "Edit Rule: Add IP to List" : "Add Rule: Add IP to List"}
            subtitle="Automatically block IPs that exceed a request threshold by adding them to a Cloudflare IP List."
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            )}
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                <div className="rounded-md border border-blue-100 bg-blue-50 overflow-hidden transition-all duration-300">
                    <button
                        type="button"
                        onClick={() => setIsHelpOpen(!isHelpOpen)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-100/40 hover:bg-blue-100/60 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <p className="text-xs font-bold text-blue-800">How "Add IP to List" Rules Work</p>
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
                        <div className="px-4 pb-4 pt-3 space-y-2.5 border-t border-blue-100/40 text-xs text-blue-700 leading-relaxed">
                            <p>
                                This rule scans your zone's request logs at regular intervals. IPs matching your threshold criteria are automatically sent to the selected Cloudflare list.
                            </p>
                            <div className="space-y-1.5 pl-1.5 border-l-2 border-blue-200">
                                <div>
                                    <span className="font-bold">1. Select/Create List:</span> Choose a list resource below.
                                </div>
                                <div>
                                    <span className="font-bold">2. Configure WAF on Cloudflare:</span> In the Cloudflare dashboard, ensure you have a WAF custom rule configured to block requests coming from this IP list. E.g., action <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-100">Block</span> if <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-100">ip.src in $list_name</span>.
                                </div>
                                <div>
                                    <span className="font-bold">3. Token Permissions:</span> The token must possess <span className="font-semibold text-slate-800">Account ➔ Account Filter Lists ➔ Edit</span> and <span className="font-semibold text-slate-800">Zone ➔ Analytics ➔ Read</span>.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-700 font-bold">
                        {error}
                    </div>
                )}

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Identity</p>
                    <div>
                        <label className={labelCls}>Rule Name <span className="text-rose-500">*</span></label>
                        <input type="text" name="name" defaultValue={rule?.name} placeholder='e.g. "API Rate Limiting"' required className={inputCls} />
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">Internal name for this rule in FlareStack.</p>
                    </div>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Target list</p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Select CF IP List <span className="text-rose-500">*</span></label>
                            <select
                                name="cfListId"
                                required
                                className={inputCls}
                                disabled={isLoadingLists}
                                value={selectedListId}
                                onChange={(e) => setSelectedListId(e.target.value)}
                            >
                                <option value="">{isLoadingLists ? "Discovering lists..." : discoveredLists.length > 0 ? "Select list..." : "No lists found"}</option>
                                {discoveredLists.map((l: any) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name} ({l.kind}: {l.id.slice(0, 8)}…)
                                    </option>
                                ))}
                                {rule && !discoveredLists.some(l => l.id === selectedListId) && selectedListId && (
                                    <option value={selectedListId}>{rule.cfListName || "Currently Selected List"} ({selectedListId.slice(0, 8)}…)</option>
                                )}
                            </select>
                            {discoveredLists.length === 0 && !isLoadingLists && (
                                <p className="mt-1 text-[10px] text-rose-500 font-medium italic select-none">No IP lists found. Go to CF → Manage Account → Lists to create one.</p>
                            )}
                            <p className="mt-1.5 text-xs text-black font-medium opacity-80">
                                Flagged IPs will be added here. Your WAF rule must reference this list to enforce blocking.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Detection thresholds</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Threshold (requests)</label>
                            <input type="number" name="rateLimitThreshold" defaultValue={rule?.rateLimitThreshold ?? 10000} min={process.env.NODE_ENV === "development" ? 1 : 100} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Window (seconds)</label>
                            <input type="number" name="windowSeconds" defaultValue={rule?.windowSeconds ?? 300} min={60} className={inputCls} />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-black font-medium opacity-80 pb-1">
                        IPs exceeding the threshold within the window get added to the list. <br />
                        <span className="italic">Note:</span> This window also determines how often this rule checks for abuse (e.g., a 300s window means it runs every 5 minutes).
                    </p>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className={sectionLabelCls}>Custom API Token Override</p>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Optional</span>
                    </div>
                    <div className="relative mt-1">
                        <input
                            type={showTokenOverride ? "text" : "password"}
                            name="cfApiTokenOverride"
                            value={cfApiTokenOverride}
                            onChange={(e) => setCfApiTokenOverride(e.target.value)}
                            placeholder="Paste custom API token to override default..."
                            className={`${monoCls} pr-10`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowTokenOverride(!showTokenOverride)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showTokenOverride ? (
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
                    <p className="mt-1.5 text-[10px] text-slate-500 font-medium">
                        Use a restricted API token specifically for this rule. If empty, the default account token will be used.
                    </p>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Token Permissions Check</p>
                    <TokenPermissionsValidator
                        zoneId={zoneId}
                        ruleType="add_ip_to_list"
                        cfApiTokenOverride={debouncedToken}
                        onValidationComplete={setIsTokenValid}
                    />
                </div>

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={rule ? "Save Changes" : "Add Rule"} disabled={!isTokenValid} />
            </form>
        </ModalShell>
    );
}
