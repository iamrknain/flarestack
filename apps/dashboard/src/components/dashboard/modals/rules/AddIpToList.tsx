"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardAction } from "~/app/dashboard/actions";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls } from "../../ui/shared";

export function AddIpToList({ zoneId, onClose, isSubmitting: initialIsSubmitting, zones, accounts, config }: {
    zoneId: string;
    onClose: () => void;
    isSubmitting: boolean;
    zones: any[];
    accounts: any[];
    config: any;
}) {
    const router = useRouter();
    const [discoveredLists, setDiscoveredLists] = useState<any[]>([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedListId, setSelectedListId] = useState("");

    useEffect(() => {
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            setIsLoadingLists(true);
            const formData = new FormData();
            formData.append("accountRef", zone.cfAccountRef);
            formData.append("type", "lists");
            fetch("/api/cloudflare", {
                method: "POST",
                body: formData,
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setDiscoveredLists(data);
                    }
                })
                .catch(err => console.error("Fetch lists error:", err))
                .finally(() => setIsLoadingLists(false));
        }
    }, [zoneId, zones]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const formData = new FormData(e.currentTarget);
            const res = await dashboardAction(formData);
            if (res?.success) {
                router.refresh();
                onClose();
            } else {
                setError(res?.error || "Failed to add rule");
            }
        } catch (err) {
            console.error("Add rule error:", err);
            setError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedListName = discoveredLists.find(l => l.id === selectedListId)?.name || "";

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-emerald-100"
            title={`Add Rule: ${config.name}`}
            subtitle={config.description}
            icon={config.icon}
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                <input type="hidden" name="intent" value="add_rule" />
                <input type="hidden" name="ruleType" value={config.type} />
                <input type="hidden" name="zoneConfigId" value={zoneId} />
                <input type="hidden" name="cfListName" value={selectedListName} />

                {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-700 font-bold">
                        {error}
                    </div>
                )}

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Identity</p>
                    <div>
                        <label className={labelCls}>Rule Name <span className="text-rose-500">*</span></label>
                        <input type="text" name="name" placeholder='e.g. "API Rate Limiting"' required className={inputCls} />
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
                            <input type="number" name="rateLimitThreshold" defaultValue={10000} min={process.env.NODE_ENV === "development" ? 1 : 100} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Window (seconds)</label>
                            <input type="number" name="windowSeconds" defaultValue={300} min={60} className={inputCls} />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-black font-medium opacity-80 pb-1">
                        IPs exceeding the threshold within the window get added to the list. <br />
                        <span className="italic">Note:</span> This window also determines how often this rule checks for abuse (e.g., a 300s window means it runs every 5 minutes).
                    </p>
                </div>

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Add Rule" />
            </form>
        </ModalShell>
    );
}
