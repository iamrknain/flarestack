import { useEffect, useState } from "react";
import { fetchIpDetails, getFlagEmoji, type IpDetailsData } from "~/lib/ip-lookup";
import { ListActionSelection, createCopyAction, createDeleteAction } from "./ListActionSelection";

export function IpLookupModal({
    isOpen,
    onClose,
    ipAddresses,
    onDeleteSelected
}: {
    isOpen: boolean;
    onClose: () => void;
    ipAddresses: string[];
    onDeleteSelected?: (ips: string[]) => Promise<void>;
}) {
    const [loading, setLoading] = useState(false);
    const [detailsList, setDetailsList] = useState<IpDetailsData[]>([]);
    const [expandedIp, setExpandedIp] = useState<string | null>(null);
    const [checkedIps, setCheckedIps] = useState<Set<string>>(new Set());
    const [copied, setCopied] = useState(false);
    const [modalDeleteLoading, setModalDeleteLoading] = useState(false);
    const [refreshingIp, setRefreshingIp] = useState<string | null>(null);

    const handleRefreshIp = async (ip: string) => {
        setRefreshingIp(ip);
        try {
            const fresh = await fetchIpDetails(ip);
            setDetailsList(prev => prev.map(item => item.ip === ip ? fresh : item));
        } catch (err) {
            console.error("Failed to refresh IP details:", err);
        } finally {
            setRefreshingIp(null);
        }
    };

    useEffect(() => {
        if (!isOpen || ipAddresses.length === 0) return;

        let isMounted = true;
        setLoading(true);
        setDetailsList([]);
        setCheckedIps(new Set());
        setExpandedIp(ipAddresses[0]); // Default expand the first item

        Promise.all(ipAddresses.map(ip => fetchIpDetails(ip))).then((results) => {
            if (isMounted) {
                setDetailsList(results);
                // Keep checked items empty by default
                setCheckedIps(new Set());
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const activeDetails = detailsList.find(d => d.ip === expandedIp);
    const lat = activeDetails?.latitude;
    const lon = activeDetails?.longitude;

    return (
        <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center gap-4 px-6 pt-6 pb-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                            <path d="M2 12h20" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">IP Address Intelligence</h3>
                            <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-black uppercase tracking-widest shrink-0">
                                {detailsList.length} {detailsList.length === 1 ? "IP" : "IPs"} Inspected
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-tight">
                            Geolocation, routing networks, and metadata analysis from global WHOIS lookups.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

                    {/* Left Pane: Table list of all selected IPs */}
                    <div className="w-full lg:w-7/12 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col overflow-hidden">
                        <div className="bg-slate-50/30 px-4 py-2 border-b border-slate-100 shrink-0">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Targets List</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 rounded-xl bg-slate-50 border border-slate-100 animate-pulse flex items-center px-4 justify-between">
                                            <div className="space-y-2">
                                                <div className="h-4 w-32 bg-slate-200 rounded" />
                                                <div className="h-3 w-48 bg-slate-100 rounded" />
                                            </div>
                                            <div className="h-4 w-12 bg-slate-200 rounded" />
                                        </div>
                                    ))}
                                </div>
                            ) : detailsList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-20">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-900 mb-1">All Target IPs Processed</span>
                                    <p className="text-[11px] text-slate-500 max-w-[260px] mb-4">Every selected entry has been successfully removed from Cloudflare.</p>
                                    <button onClick={onClose} className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm">
                                        Close Window
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {detailsList.map((details) => {
                                        const isSelected = expandedIp === details.ip;
                                        return (
                                            <div
                                                key={details.ip}
                                                onClick={() => setExpandedIp(details.ip)}
                                                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isSelected
                                                        ? "bg-violet-50/20 border-violet-200 shadow-sm"
                                                        : "bg-white border-slate-100 hover:border-slate-200"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={checkedIps.has(details.ip)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            const next = new Set(checkedIps);
                                                            if (e.target.checked) {
                                                                next.add(details.ip);
                                                            } else {
                                                                next.delete(details.ip);
                                                            }
                                                            setCheckedIps(next);
                                                        }}
                                                        className="w-4 h-4 rounded-md border-slate-200 text-slate-950 focus:ring-slate-950 cursor-pointer shrink-0"
                                                    />
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-bold text-slate-900 text-sm truncate">{details.ip}</span>
                                                            {details.version && (
                                                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase shrink-0">
                                                                    {details.version}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {details.error ? (
                                                            <span className="text-rose-500 text-[10px] font-bold block">✖ {details.error}</span>
                                                        ) : (
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 font-medium">
                                                                <span>{getFlagEmoji(details.country_code)} {details.city || details.region ? `${details.city || ""}, ${details.region || ""}` : details.country_name}</span>
                                                                <span className="text-slate-300">•</span>
                                                                <span className="truncate max-w-[200px]">{details.org || "Unknown ISP"}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                                    <div className="flex flex-col items-end gap-1">
                                                        {details.asn && (
                                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50/70 px-2 py-0.5 rounded border border-blue-100">
                                                                {details.asn}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRefreshIp(details.ip);
                                                            }}
                                                            disabled={refreshingIp === details.ip}
                                                            className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 rounded px-1.5 py-0.5 transition-colors mt-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                                                            title="Force re-fetch IP details"
                                                        >
                                                            {refreshingIp === details.ip ? "Syncing..." : "Refresh"}
                                                        </button>
                                                    </div>
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        className={`text-slate-400 transition-transform ${isSelected ? "translate-x-1 text-violet-500" : ""}`}
                                                    >
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Sticky Action Footer */}
                        {detailsList.length > 0 && (
                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={detailsList.length > 0 && checkedIps.size === detailsList.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setCheckedIps(new Set(detailsList.map(d => d.ip)));
                                            } else {
                                                setCheckedIps(new Set());
                                            }
                                        }}
                                        className="w-4 h-4 rounded-md border-slate-200 text-slate-950 focus:ring-slate-950 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Select All</span>
                                </div>

                                <ListActionSelection
                                    selectedCount={checkedIps.size}
                                    onClear={() => setCheckedIps(new Set())}
                                    placement="top"
                                    align="right"
                                    actions={[
                                        createCopyAction(checkedIps, () => {
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }),
                                        createDeleteAction(
                                            checkedIps.size,
                                            async () => {
                                                if (!onDeleteSelected) return;
                                                const ips = Array.from(checkedIps);
                                                if (ips.length === 0) return;
                                                if (!confirm(`Are you sure you want to delete the ${ips.length} selected IP(s) from Cloudflare?`)) return;

                                                setModalDeleteLoading(true);
                                                try {
                                                    await onDeleteSelected(ips);

                                                    // Remove deleted IPs from local modal list
                                                    const remaining = detailsList.filter(d => !ips.includes(d.ip));
                                                    setDetailsList(remaining);
                                                    setCheckedIps(new Set());

                                                    // Reset active detail projection
                                                    if (expandedIp && ips.includes(expandedIp)) {
                                                        setExpandedIp(remaining.length > 0 ? remaining[0].ip : null);
                                                    }
                                                } catch (err: any) {
                                                    console.error("Failed to delete IPs from modal:", err);
                                                    alert(`Modal Delete Error: ${err.message || err}`);
                                                } finally {
                                                    setModalDeleteLoading(false);
                                                }
                                            },
                                            modalDeleteLoading
                                        )
                                    ]}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Pane: Detailed information & Live OSM Map of the active expanded IP */}
                    <div className="w-full lg:w-5/12 flex flex-col overflow-hidden bg-slate-50/20">
                        <div className="bg-slate-50/30 px-4 py-2 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Geographic & Network Details</span>
                            {activeDetails && !activeDetails.error && (
                                <span className="text-[9px] font-bold text-slate-400 font-mono">{activeDetails.ip}</span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
                            {!activeDetails ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                    <span className="text-xs font-semibold">Select an IP on the left to analyze its details</span>
                                </div>
                            ) : activeDetails.error ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                    <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                    </div>
                                    <h4 className="text-[14px] font-bold text-slate-900 mb-1">Lookup Failed</h4>
                                    <p className="text-[11px] text-slate-500 max-w-[280px]">{activeDetails.error}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Sub-grid of details */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-left">
                                        <div className="flex flex-col border-b border-slate-100 pb-1 col-span-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Network Range</span>
                                            <span className="text-[12px] font-bold text-slate-800 font-mono">{activeDetails.network || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Timezone</span>
                                            <span className="text-[12px] font-bold text-slate-800">{activeDetails.timezone || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">UTC Offset</span>
                                            <span className="text-[12px] font-bold text-slate-800 font-mono">{activeDetails.utc_offset || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Country Capital</span>
                                            <span className="text-[12px] font-bold text-slate-800">{activeDetails.country_capital || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Country TLD</span>
                                            <span className="text-[12px] font-bold text-slate-800 font-mono">{activeDetails.country_tld || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Calling Code</span>
                                            <span className="text-[12px] font-bold text-slate-800">{activeDetails.country_calling_code || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Currency</span>
                                            <span className="text-[12px] font-bold text-slate-800">{activeDetails.currency_name || "N/A"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-100 pb-1 col-span-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Languages</span>
                                            <span className="text-[12px] font-bold text-slate-800 truncate">{activeDetails.languages || "N/A"}</span>
                                        </div>
                                    </div>

                                    {/* OSM Live Projection Map */}
                                    <div className="relative h-48 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center shrink-0">
                                        {lat && lon ? (
                                            <>
                                                <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-slate-200/50 flex flex-col">
                                                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Coordinates</span>
                                                    <span className="text-[10px] font-mono font-bold text-slate-800">{lat.toFixed(4)}, {lon.toFixed(4)}</span>
                                                </div>
                                                <iframe
                                                    width="100%"
                                                    height="100%"
                                                    frameBorder={0}
                                                    scrolling="no"
                                                    marginHeight={0}
                                                    marginWidth={0}
                                                    className="brightness-[0.95]"
                                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.15},${lat - 0.15},${lon + 0.15},${lat + 0.15}&layer=mapnik&marker=${lat},${lon}`}
                                                />
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                                                <span className="text-[10px] font-medium">Map projection unavailable</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
