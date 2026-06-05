"use client";

import { useState, useEffect } from "react";
import { getZonesAction, addZone, editZone } from "~/server/cloudflare";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls } from "../ui/shared";

export function AddZone({
    onClose,
    accounts,
    onRefresh,
    zone,
}: {
    onClose: () => void;
    accounts: any[];
    onRefresh?: () => void;
    zone?: any;
}) {
    const [selectedAccount, setSelectedAccount] = useState("");
    const [discoveredZones, setDiscoveredZones] = useState<any[]>([]);
    const [isFetchingZones, setIsFetchingZones] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedZoneId, setSelectedZoneId] = useState("");

    const selectedZoneObj = discoveredZones.find((z) => z.id === selectedZoneId);

    useEffect(() => {
        if (selectedAccount && !zone) {
            setIsFetchingZones(true);
            getZonesAction(selectedAccount)
            .then(data => {
                if (Array.isArray(data)) {
                    setDiscoveredZones(data);
                } else {
                    setDiscoveredZones([]);
                }
            })
            .catch(() => setDiscoveredZones([]))
            .finally(() => setIsFetchingZones(false));
        } else {
            setDiscoveredZones([]);
        }
        setSelectedZoneId("");
    }, [selectedAccount, zone]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;

        const result = zone
            ? await editZone(zone.id, name)
            : await addZone(name, formData.get("cfZoneId") as string, formData.get("cfAccountRef") as string, selectedZoneObj?.name || null);

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
            title={zone ? "Edit Zone" : "Add Zone"}
            subtitle={zone ? "Update website settings" : "Which domain's traffic to monitor"}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                     <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-5 space-y-5 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Zone Settings</p>
                    
                    {zone ? (
                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>Website Name <span className="text-rose-500">*</span></label>
                                <input type="text" name="name" defaultValue={zone.name} required className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Cloudflare Account</label>
                                <input type="text" disabled value={accounts.find(a => a.id === zone.cfAccountRef)?.label || "Connected Account"} className={inputCls + " opacity-65 bg-gray-100"} />
                            </div>
                            <div>
                                <label className={labelCls}>Domain</label>
                                <input type="text" disabled value={zone.domain || zone.cfZoneId} className={inputCls + " opacity-65 bg-gray-100"} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>Website Name <span className="text-rose-500">*</span></label>
                                <input type="text" name="name" placeholder='e.g. "My Production Site"' required className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Cloudflare Account <span className="text-rose-500">*</span></label>
                                <select
                                    name="cfAccountRef"
                                    required
                                    className={inputCls}
                                    value={selectedAccount}
                                    onChange={(e) => setSelectedAccount(e.target.value)}
                                >
                                    <option value="">Select account…</option>
                                    {accounts.map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.label} ({a.cfAccountId.slice(0, 8)}…)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Select Domain (Zone ID) <span className="text-rose-500">*</span></label>
                                <select
                                    name="cfZoneId"
                                    required
                                    className={inputCls}
                                    disabled={!selectedAccount || isFetchingZones}
                                    value={selectedZoneId}
                                    onChange={(e) => setSelectedZoneId(e.target.value)}
                                >
                                    <option value="">{isFetchingZones ? "Discovering zones..." : discoveredZones.length > 0 ? "Select domain..." : "Pick an account first"}</option>
                                    {discoveredZones.map((z: any) => (
                                        <option key={z.id} value={z.id}>
                                            {z.name} ({z.id.slice(0, 8)}…)
                                        </option>
                                    ))}
                                </select>
                                {discoveredZones.length === 0 && selectedAccount && !isFetchingZones && (
                                    <p className="mt-1 text-[10px] text-rose-500 font-bold italic select-none uppercase tracking-tight">No zones found. Check token permissions.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mx-6 -mt-1 flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md px-4 py-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p className="text-xs font-semibold leading-relaxed">{error}</p>
                    </div>
                )}
                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={zone ? "Save Changes" : "Add Zone"} />
            </form>
        </ModalShell>
    );
}
