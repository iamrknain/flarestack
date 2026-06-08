import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleZoneStatus, deleteZone, toggleCloudflareRuleStatus, deleteCloudflareRule, toggleZoneArchiveStatus } from "~/server/cloudflare";

export function ZonesList({ zones, accounts, rules, onAddZone, onAddRule, onEditZone, onEditRule, onRefresh }: {
    zones: any[];
    accounts: any[];
    rules: any[];
    onAddZone: () => void;
    onAddRule: (zoneId: string) => void;
    onEditZone?: (zone: any) => void;
    onEditRule?: (rule: any) => void;
    onRefresh?: () => void;
}) {
    const router = useRouter();
    const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

    const toggleExpanded = (zoneId: string) => {
        setExpandedZones(prev => ({ ...prev, [zoneId]: prev[zoneId] === false ? true : false }));
    };

    const handleAction = async (e: React.FormEvent, intent: string, params: Record<string, string>) => {
        e.preventDefault();
        const key = `${intent}-${params.id || params.zoneId || params.ruleId}`;
        setSubmittingId(key);
        try {
            let res;
            if (intent === "toggle_zone_status") {
                res = await toggleZoneStatus(params.zoneId, params.isActive === "true");
            } else if (intent === "delete_zone") {
                res = await deleteZone(params.zoneId);
            } else if (intent === "toggle_rule_status") {
                res = await toggleCloudflareRuleStatus(params.ruleId, params.ruleType, params.isActive === "true");
            } else if (intent === "delete_rule") {
                res = await deleteCloudflareRule(params.ruleId, params.ruleType);
            } else if (intent === "toggle_zone_archive") {
                res = await toggleZoneArchiveStatus(params.zoneId, params.isArchived === "true");
            }

            if (res?.success) {
                router.refresh();
                if (onRefresh) onRefresh();
            } else {
                alert(res?.error || `Failed to perform ${intent}`);
            }
        } catch (err) {
            console.error("Action error:", err);
        } finally {
            setSubmittingId(null);
        }
    };

    const activeZones = zones.filter((z) => !z.isArchived);
    const archivedZones = zones.filter((z) => z.isArchived);

    const renderZoneRow = (zone: any) => {
        const account = accounts.find((a) => a.id === zone.cfAccountRef);
        const zoneRules = rules.filter((r) => r.zoneConfigId === zone.id);
        const isExpanded = expandedZones[zone.id] !== false; // true by default

        return (
            <div key={zone.id} className={`px-3 sm:px-5 py-4 border-b border-gray-100 last:border-0 ${zone.isArchived ? 'bg-slate-50/50 opacity-80' : 'bg-gradient-to-br from-white to-gray-50/30'}`}>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                    <form
                        onSubmit={(e: React.FormEvent) => {
                            const message = zone.isActive
                                ? "Deactivating this zone will also disable all protection rules for it. Continue?"
                                : "Activating this zone will also enable all protection rules for it. Continue?";
                            if (confirm(message)) {
                                handleAction(e, "toggle_zone_status", {
                                    zoneId: zone.id,
                                    isActive: (!zone.isActive).toString()
                                });
                            } else {
                                e.preventDefault();
                            }
                        }}
                        className="shrink-0"
                    >
                        <button
                            type="submit"
                            disabled={submittingId === `toggle_zone_status-${zone.id}`}
                            className={`group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors disabled:opacity-50 ${zone.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                            <span className="sr-only">Toggle zone status</span>
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${zone.isActive ? 'translate-x-2.5' : '-translate-x-2.5'}`}
                            />
                        </button>
                    </form>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 order-last sm:order-none w-full sm:w-auto sm:flex-1 min-w-0">
                        <div className="flex flex-col min-w-0 shrink-0">
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Zone Name</span>
                            <span className="text-sm font-black text-slate-900 truncate" title={zone.name}>{zone.name}</span>
                        </div>
                        <div className="flex flex-col min-w-0 shrink-0">
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Domain</span>
                            <span className="text-xs font-mono font-semibold text-slate-600 truncate" title={zone.domain || "—"}>{zone.domain || "—"}</span>
                        </div>
                        <div className="flex flex-col min-w-0 shrink-0">
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Account</span>
                            <span className="text-xs font-black text-indigo-600 truncate" title={account?.label || "Unknown Account"}>{account?.label || "Unknown Account"}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                        <a
                            href={`/dashboard/stats?zoneId=${zone.id}`}
                            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-md transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            Explore
                        </a>

                        <button
                            onClick={() => onAddRule(zone.id)}
                            disabled={!zone.isActive}
                            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-slate-100 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Rule
                        </button>

                        <button
                            type="button"
                            onClick={() => onEditZone?.(zone)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-md transition-all shadow-sm shrink-0"
                            title="Edit zone"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                        </button>

                        <form onSubmit={(e: React.FormEvent) => {
                            e.preventDefault();
                            const message = zone.isArchived
                                ? `Unarchive zone "${zone.name}"?`
                                : `Archive zone "${zone.name}"?`;
                            if (confirm(message)) {
                                handleAction(e, "toggle_zone_archive", { zoneId: zone.id, isArchived: (!zone.isArchived).toString() });
                            }
                        }}>
                            <button
                                type="submit"
                                disabled={submittingId === `toggle_zone_archive-${zone.id}`}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-md transition-all shadow-sm shrink-0"
                                title={zone.isArchived ? "Unarchive Zone" : "Archive Zone"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={zone.isArchived ? "text-amber-500" : ""}>
                                    <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
                                    <path d="M23 3H1v5h22V3Z" />
                                    <path d="M10 12h4" />
                                </svg>
                            </button>
                        </form>

                        <form onSubmit={(e: React.FormEvent) => {
                            if (confirm(`Delete zone "${zone.name}" and all its rules?`)) {
                                handleAction(e, "delete_zone", { zoneId: zone.id });
                            } else {
                                e.preventDefault();
                            }
                        }}>
                            <button type="submit" disabled={submittingId === `delete_zone-${zone.id}`} className="p-1.5 text-rose-500 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-md transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                        </form>
                    </div>
                </div>

                {/* Rules under this zone */}
                {zoneRules.length > 0 && (
                    <div className={`mt-4 bg-gradient-to-br from-white to-indigo-50/40 border border-indigo-100/60 rounded-md shadow-sm transition-all overflow-hidden ${isExpanded ? 'p-3 sm:p-4' : 'px-3 sm:px-4 py-2.5'}`}>
                        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4' : ''}`}>
                            <span className="text-[9px] uppercase font-black text-indigo-600 tracking-[0.2em] opacity-80 shrink-0">Active Rules</span>
                            <div className="h-[1px] flex-1 mx-3 bg-indigo-100" />
                            <button
                                onClick={() => toggleExpanded(zone.id)}
                                className="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-1 rounded-md transition-colors shadow-sm"
                                title={isExpanded ? "Collapse rules" : "Expand rules"}
                            >
                                <span>{zoneRules.length} {zoneRules.length === 1 ? 'Rule' : 'Rules'}</span>
                                <svg className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                        </div>
                        {isExpanded && (
                            <div className="space-y-2">
                                {zoneRules.map((rule) => (
                                    <div key={rule.id} className={`flex flex-wrap sm:flex-nowrap justify-between sm:justify-start items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-white border ${rule.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'} shadow-sm rounded-md group/rule hover:border-indigo-400 transition-all`}>
                                        <form
                                            onSubmit={(e) => {
                                                handleAction(e, "toggle_rule_status", {
                                                    ruleId: rule.id,
                                                    isActive: (!rule.isActive).toString(),
                                                    ruleType: rule.type
                                                });
                                            }}
                                            className="flex items-center flex-shrink-0"
                                        >
                                            <button
                                                type="submit"
                                                disabled={!zone.isActive || submittingId === `toggle_rule_status-${rule.id}`}
                                                className={`group relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors disabled:cursor-not-allowed ${rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'} ${!zone.isActive ? 'opacity-50' : ''}`}
                                            >
                                                <span className="sr-only">Toggle rule status</span>
                                                <span
                                                    aria-hidden="true"
                                                    className={`pointer-events-none absolute h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${rule.isActive ? 'translate-x-2' : '-translate-x-2'}`}
                                                />
                                            </button>
                                        </form>

                                        <div className="order-last sm:order-none w-full sm:w-auto sm:flex-1 min-w-0">
                                            <RuleDetails rule={rule} />
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => onEditRule?.(rule)}
                                                title="Edit rule"
                                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-all bg-white rounded-md shadow-sm border border-gray-100 shrink-0"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                </svg>
                                            </button>

                                            <form onSubmit={(e: React.FormEvent) => {
                                                if (confirm("Delete this rule?")) {
                                                    handleAction(e, "delete_rule", {
                                                        ruleId: rule.id,
                                                        ruleType: rule.type
                                                    });
                                                } else {
                                                    e.preventDefault();
                                                }
                                            }}>
                                                <button type="submit" disabled={submittingId === `delete_rule-${rule.id}`} title="Delete rule" className="p-1.5 text-rose-500 hover:text-rose-700 transition-all bg-white rounded-md shadow-sm border border-gray-100 shrink-0 disabled:opacity-50">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                        <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.04-1.24.11a4.5 4.5 0 0 0-8.87-.22c-.22-.05-.44-.08-.66-.08-2.5 0-4.5 2-4.5 4.5S4 20 6.5 20h11" />
                    </svg>
                    Monitored Zones
                </h2>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{activeZones.length} Active</span>
                    {accounts.length > 0 && (
                        <button
                            onClick={onAddZone}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Zone
                        </button>
                    )}
                </div>
            </div>

            <div className="divide-y divide-gray-100">
                {activeZones.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <p className="text-black font-medium text-sm">No active zones configured.</p>
                        {accounts.length > 0 && (
                            <button onClick={onAddZone} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                                + Add your first zone
                            </button>
                        )}
                    </div>
                ) : (
                    activeZones.map(renderZoneRow)
                )}
            </div>

            {archivedZones.length > 0 && (
                <div className="border-t border-gray-200/80 bg-slate-50/20">
                    <button
                        onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                                <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
                                <path d="M23 3H1v5h22V3Z" />
                                <path d="M10 12h4" />
                            </svg>
                            <span className="text-sm font-bold text-slate-700">Archived Zones</span>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{archivedZones.length}</span>
                        </div>
                        <svg
                            className={`transition-transform duration-200 text-slate-500 ${isArchiveExpanded ? 'rotate-180' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    
                    {isArchiveExpanded && (
                        <div className="divide-y divide-gray-100 border-t border-gray-100 bg-white">
                            {archivedZones.map(renderZoneRow)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function RuleDetails({ rule }: { rule: any }) {
    if (rule.type === "add_ip_to_list") {
        return (
            <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1.5fr_1fr_1.2fr_0.8fr_2fr] gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-indigo-500/80 leading-none mb-1">IP Mitigation</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">List Target</span>
                    <span className="text-xs font-black text-indigo-600 truncate leading-tight" title={rule.cfListName || "Global List"}>
                        {rule.cfListName || "Global List"}
                    </span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Trigger Limit</span>
                    <span className="text-xs font-black text-amber-700 truncate leading-tight">{rule.rateLimitThreshold?.toLocaleString()} Hits</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">OFF Trigger</span>
                    <span className="text-xs font-black text-slate-400 truncate leading-tight">—</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Window</span>
                    <span className="text-xs font-black text-slate-800 truncate leading-tight">{rule.windowSeconds}s</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Notifications</span>
                    <span className="text-xs font-black text-slate-400 truncate leading-tight">—</span>
                </div>
            </div>
        );
    }
    if (rule.type === "under_attack_mode") {
        return (
            <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1.5fr_1fr_1.2fr_0.8fr_2fr] gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-rose-500/80 leading-none mb-1">Under Attack</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Target / Scope</span>
                    <span className="text-xs font-black text-slate-500 truncate leading-tight">Entire Zone</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">ON Trigger</span>
                    <span className="text-xs font-black text-rose-700 truncate leading-tight">{rule.rateLimitThreshold?.toLocaleString()} Reqs</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">OFF Trigger</span>
                    <span className="text-xs font-black text-emerald-700 truncate leading-tight">
                        {rule.autoOff ? `${rule.offThreshold?.toLocaleString()} Reqs` : "Manual"}
                    </span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Window</span>
                    <span className="text-xs font-black text-slate-800 truncate leading-tight">{rule.windowSeconds}s</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Notifications</span>
                    <span className="text-xs font-black text-blue-700 truncate leading-tight" title={rule.notifyEmails || "Disabled"}>
                        {rule.sendNotification ? (rule.notifyEmails || "Enabled") : "Disabled"}
                    </span>
                </div>
            </div>
        );
    }
    if (rule.type === "waf_rule") {
        return (
            <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1.5fr_1fr_1.2fr_0.8fr_2fr] gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-indigo-500/80 leading-none mb-1">WAF Automation</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">WAF Target Rule</span>
                    <span className="text-xs font-black text-indigo-600 truncate leading-tight" title={rule.cfRuleName}>{rule.cfRuleName}</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">ON Trigger</span>
                    <span className="text-xs font-black text-rose-700 truncate leading-tight">{rule.rateLimitThreshold?.toLocaleString()} Reqs</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">OFF Trigger</span>
                    <span className="text-xs font-black text-emerald-700 truncate leading-tight">
                        {rule.autoOff ? `${rule.offThreshold?.toLocaleString()} Reqs` : "Manual"}
                    </span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Window</span>
                    <span className="text-xs font-black text-slate-800 truncate leading-tight">{rule.windowSeconds}s</span>
                </div>
                <div className="flex flex-col min-w-0 shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400/80 leading-none mb-1">Notifications</span>
                    <span className="text-xs font-black text-blue-700 truncate leading-tight" title={rule.notifyEmails || "Disabled"}>
                        {rule.sendNotification ? (rule.notifyEmails || "Enabled") : "Disabled"}
                    </span>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-black text-slate-900 uppercase">{rule.name || rule.type}</span>
        </div>
    );
}
