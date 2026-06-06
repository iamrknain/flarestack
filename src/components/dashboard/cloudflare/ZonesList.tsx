import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleZoneStatus, deleteZone, toggleCloudflareRuleStatus, deleteCloudflareRule } from "~/server/cloudflare";

export function ZonesList({ zones, accounts, rules, onAddZone, onAddRule, onEditZone, onEditRule }: {
    zones: any[];
    accounts: any[];
    rules: any[];
    onAddZone: () => void;
    onAddRule: (zoneId: string) => void;
    onEditZone?: (zone: any) => void;
    onEditRule?: (rule: any) => void;
}) {
    const router = useRouter();
    const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
    const [submittingId, setSubmittingId] = useState<string | null>(null);

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
            }

            if (res?.success) {
                router.refresh();
            } else {
                alert(res?.error || `Failed to perform ${intent}`);
            }
        } catch (err) {
            console.error("Action error:", err);
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Monitored Zones</h2>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{zones.length} Protected</span>
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
                {zones.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <p className="text-black font-medium text-sm">No zones configured yet.</p>
                        {accounts.length > 0 && (
                            <button onClick={onAddZone} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                                + Add your first zone
                            </button>
                        )}
                    </div>
                ) : (
                    zones.map((zone) => {
                        const account = accounts.find((a) => a.id === zone.cfAccountRef);
                        const zoneRules = rules.filter((r) => r.zoneConfigId === zone.id);
                        const isExpanded = expandedZones[zone.id] !== false; // true by default

                        return (
                            <div key={zone.id} className="p-6 border-b border-gray-100 last:border-0 bg-gradient-to-br from-white to-gray-50/30">
                                <div className="flex justify-between items-center gap-4">
                                    <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
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

                                        <div className="flex items-baseline gap-2 shrink-0 max-w-[50%]">
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{zone.name}</h3>
                                            {zone.domain && (
                                                <span className="text-xs text-slate-400 font-mono tracking-tight font-medium shrink-0">
                                                    ({zone.domain})
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            <span className="text-[10px] font-black text-slate-500 tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">{account?.label || "Unknown Account"}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <a
                                            href={`/dashboard/ips?zoneId=${zone.id}`}
                                            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            </svg>
                                            Explore
                                        </a>



                                        <button
                                            onClick={() => onAddRule(zone.id)}
                                            disabled={!zone.isActive}
                                            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Add Rule
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onEditZone?.(zone)}
                                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors shrink-0"
                                            title="Edit zone"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                            </svg>
                                        </button>

                                        <form onSubmit={(e: React.FormEvent) => {
                                            if (confirm(`Delete zone "${zone.name}" and all its rules?`)) {
                                                handleAction(e, "delete_zone", { zoneId: zone.id });
                                            } else {
                                                e.preventDefault();
                                            }
                                        }}>
                                            <button type="submit" disabled={submittingId === `delete_zone-${zone.id}`} className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                                </svg>
                                            </button>
                                        </form>
                                    </div>
                                </div>

                                {/* Rules under this zone */}
                                {zoneRules.length > 0 && (
                                    <div className={`mt-8 bg-gradient-to-br from-white to-indigo-50/40 border border-indigo-100/60 rounded-md shadow-sm transition-all overflow-hidden ${isExpanded ? 'p-5' : 'px-5 py-3'}`}>
                                        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4' : ''}`}>
                                            <span className="text-[9px] uppercase font-black text-indigo-600 tracking-[0.2em] opacity-80 shrink-0">Active Rules</span>
                                            <div className="h-[1px] flex-1 mx-4 bg-indigo-100" />
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
                                            <div className="space-y-3">
                                                {zoneRules.map((rule) => (
                                                    <div key={rule.id} className={`flex items-center gap-4 px-5 py-3 bg-white border ${rule.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'} shadow-sm rounded-md group/rule hover:border-indigo-400 transition-all`}>
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

                                                        <RuleDetails rule={rule} />

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
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function RuleDetails({ rule }: { rule: any }) {
    if (rule.type === "add_ip_to_list") {
        return (
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                <div className="flex flex-col min-w-[120px] max-w-[180px] shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-indigo-500/80 leading-none mb-0.5">IP Mitigation</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 truncate shrink-0">{rule.cfListName || "Global List"}</span>
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    <span className="text-[11px] text-amber-700 font-black">{rule.rateLimitThreshold?.toLocaleString()}</span>
                    <span className="text-[10px] text-amber-600/70 font-bold uppercase">Hits</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase italic">{rule.windowSeconds}s Window</span>
            </div>
        );
    }
    if (rule.type === "under_attack_mode") {
        return (
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                <div className="flex flex-col min-w-[120px] max-w-[180px] shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-rose-500/80 leading-none mb-0.5">Under Attack</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <div className="flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    <span className="text-[11px] text-rose-700 font-black">{rule.rateLimitThreshold?.toLocaleString()}</span>
                    <span className="text-[10px] text-rose-600/70 font-bold uppercase">On Trigger</span>
                </div>
                {rule.autoOff ? (
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-black">{rule.offThreshold?.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase">Off Trigger</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Manual Recovery</span>
                )}
                <span className="text-[10px] text-slate-400 font-bold uppercase italic">{rule.windowSeconds}s Window</span>
                {rule.sendNotification && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100" title={rule.notifyEmails || "No emails configured"}>
                        <span className="text-[11px] text-blue-700 font-black">
                            {rule.notifyEmails ? (rule.notifyEmails.length > 20 ? rule.notifyEmails.slice(0, 20) + "..." : rule.notifyEmails) : "Enabled"}
                        </span>
                    </div>
                )}
            </div>
        );
    }
    if (rule.type === "waf_rule") {
        return (
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                <div className="flex flex-col min-w-[120px] max-w-[180px] shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-indigo-500/80 leading-none mb-0.5">WAF Automation</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 truncate shrink-0 max-w-[150px]" title={rule.cfRuleName}>{rule.cfRuleName}</span>
                <div className="flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    <span className="text-[11px] text-rose-700 font-black">{rule.rateLimitThreshold?.toLocaleString()}</span>
                    <span className="text-[10px] text-rose-600/70 font-bold uppercase">On Trigger</span>
                </div>
                {rule.autoOff ? (
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-black">{rule.offThreshold?.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase">Off Trigger</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Manual Recovery</span>
                )}
                <span className="text-[10px] text-slate-400 font-bold uppercase italic">{rule.windowSeconds}s Window</span>
                {rule.sendNotification && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100" title={rule.notifyEmails || "No emails configured"}>
                        <span className="text-[11px] text-blue-700 font-black">
                            {rule.notifyEmails ? (rule.notifyEmails.length > 20 ? rule.notifyEmails.slice(0, 20) + "..." : rule.notifyEmails) : "Enabled"}
                        </span>
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-black text-slate-900 uppercase">{rule.name || rule.type}</span>
        </div>
    );
}
