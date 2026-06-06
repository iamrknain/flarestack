import { useState, useEffect, useMemo, useRef } from "react";
import { inputCls, labelCls, glassCls } from "./ui/shared";
import { DateRangePicker, type DateRange } from "~/components/DateRangePicker";
import { PushIpToList } from "./cloudflare/PushIpToList";
import { ActionSelection, createCopyAction, createLookupAction, createAddToListAction, type SelectionAction } from "./cloudflare/ActionSelection";
import { IpLookupModal } from "./cloudflare/IpLookupModal";
import { getTopStatsAction } from "~/server/cloudflare";

export function TopStatsExplorer({
    zones,
    accounts,
    dateRange,
    onDateRangeChange,
    limit,
    onLimitChange,
    activeZoneId,
    onActiveZoneChange,
    isLoading: isGlobalLoading,
    onPauseChange
}: {
    zones: any[];
    accounts: any[];
    dateRange: DateRange;
    onDateRangeChange: (v: DateRange) => void;
    limit: number;
    onLimitChange: (v: number) => void;
    activeZoneId: string;
    onActiveZoneChange: (v: string) => void;
    isLoading: boolean;
    onPauseChange?: (v: boolean) => void;
}) {
    const [fetcherData, setFetcherData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);

    const [dimensions, setDimensions] = useState<string[]>(() => {
        if (typeof window === "undefined") return ["clientIP", "clientCountryName", "clientRequestPath"];
        try {
            const saved = localStorage.getItem("ff_top_stats_dimensions");
            if (saved) return JSON.parse(saved);
        } catch (e) { }
        return ["clientIP", "clientCountryName", "clientRequestPath"];
    });
    const [results, setResults] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isDimensionsModalOpen, setIsDimensionsModalOpen] = useState(false);
    const [isIpListAddOpen, setIsIpListAddOpen] = useState(false);
    const [isIpLookupOpen, setIsIpLookupOpen] = useState(false);
    const [ipsToPush, setIpsToPush] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [deepSearchActive, setDeepSearchActive] = useState(false);
    const dimensionsRef = useRef<HTMLDivElement>(null);

    const triggerPushIps = (ips: string[]) => {
        setIpsToPush(ips);
        setIsIpListAddOpen(true);
    };

    const displayResults = useMemo(() => {
        if (deepSearchActive || !searchQuery.trim()) return results;
        const term = searchQuery.toLowerCase().trim();
        return results.filter(r => {
            return Object.keys(r).some(key => {
                if (key === "count") return false;
                return String(r[key]).toLowerCase().includes(term);
            });
        });
    }, [results, searchQuery, deepSearchActive]);

    const handleDeepSearch = async () => {
        if (!searchQuery.trim() || !activeZoneId) return;
        setDeepSearchActive(true);
        setSelectedItems(new Set());
        await handleFetch(searchQuery, true);
    };

    const handleClearDeepSearch = async () => {
        setDeepSearchActive(false);
        setSearchQuery("");
        setSelectedItems(new Set());
        await handleFetch("", false);
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dimensionsRef.current && !dimensionsRef.current.contains(event.target as Node)) {
                setIsDimensionsModalOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedIps = Array.from(selectedItems).map(i => results[i]?.clientIP).filter(Boolean);

    const selectionActions = useMemo<SelectionAction[]>(() => {
        return [
            createCopyAction(selectedIps, () => {}),
            createLookupAction(selectedIps.length, () => setIsIpLookupOpen(true)),
            createAddToListAction(selectedIps.length, () => triggerPushIps(selectedIps))
        ];
    }, [selectedIps]);

    useEffect(() => {
        localStorage.setItem("ff_top_stats_dimensions", JSON.stringify(dimensions));
    }, [dimensions]);

    const windowSeconds = useMemo(() => {
        if (dateRange.type === "all") return null;
        if (dateRange.type === "relative") {
            const val = dateRange.relativeValue || "30m";
            const num = parseInt(val);
            const unit = val.slice(-1);
            if (unit === "m") return num * 60;
            if (unit === "h") return num * 3600;
            if (unit === "d") return num * 86400;
            return 1800;
        }
        return null;
    }, [dateRange]);

    const handleFetch = async (overrideSearchQuery?: string, overrideDeepSearch?: boolean) => {
        if (!activeZoneId) return;
        const zone = zones.find(v => v.id === activeZoneId);
        if (!zone) return;

        const useDeepSearch = overrideDeepSearch !== undefined ? overrideDeepSearch : deepSearchActive;
        const useQuery = overrideSearchQuery !== undefined ? overrideSearchQuery : searchQuery;

        setIsFetching(true);
        try {
            const data = await getTopStatsAction(
                zone.cfAccountRef,
                zone.cfZoneId,
                dimensions.length > 0 ? dimensions : ["clientIP"],
                windowSeconds || undefined,
                limit,
                (useDeepSearch && useQuery.trim()) ? useQuery.trim() : undefined
            );
            if (data && "error" in data) {
                setFetcherData({ error: data.error });
            } else {
                setFetcherData(data);
            }
        } catch (e) {
            console.error("Fetch top stats error:", e);
            setFetcherData({ error: "Failed to fetch top stats data." });
        } finally {
            setIsFetching(false);
        }
    };

    const selectedItemsSizeRef = useRef(selectedItems.size);
    useEffect(() => {
        onPauseChange?.(selectedItems.size > 0);
        selectedItemsSizeRef.current = selectedItems.size;
    }, [selectedItems.size, onPauseChange]);

    // Auto-fetch on live or range change
    useEffect(() => {
        if (!activeZoneId) return;

        // Always fetch when range or limit changes manually
        handleFetch();

        if (!dateRange.live) return;

        const intervalMs = (dateRange.refreshInterval || 15) * 1000;
        const timer = setInterval(() => {
            // Pause auto-refresh as long as the user has items selected for an action
            if (!isFetching && selectedItemsSizeRef.current === 0) {
                handleFetch();
            }
        }, intervalMs);

        return () => clearInterval(timer);
    }, [activeZoneId, dateRange.type, dateRange.relativeValue, dateRange.start, dateRange.end, dateRange.live, limit, dimensions.join(",")]);

    useEffect(() => {
        if (!fetcherData) return;
        if ((fetcherData as any).error) {
            const err = (fetcherData as any);
            setResults([]);
            setSelectedItems(new Set());
            if (err.details && err.details[0]?.extensions?.code === "authz") {
                setErrorMsg(`Access Denied: Your Cloudflare plan does not include access to this specific dimension.`);
            } else {
                setErrorMsg(err.error || "Failed to fetch top stats data.");
            }
        } else if (Array.isArray(fetcherData)) {
            setErrorMsg(null);
            setResults(fetcherData);
            setSelectedItems(new Set());
        }
    }, [fetcherData]);

    const isLoading = isFetching;

    return (
        <>
            <div className="flex flex-col gap-4 sm:gap-6">
                <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-2 sm:px-4 py-2 flex flex-row gap-1.5 items-center w-full overflow-x-auto scrollbar-hide">

                    {/* Dimensions */}
                    <div className="relative shrink-0" ref={dimensionsRef}>
                        <button
                            onClick={() => setIsDimensionsModalOpen(!isDimensionsModalOpen)}
                            className="flex items-center justify-center gap-2 px-3 h-[34px] text-[11px] font-bold bg-white border border-slate-200 rounded-md shadow-sm text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                            <svg className="w-3.5 h-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            <span>Dimensions</span>
                            {dimensions.length > 0 && (
                                <span className="bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px] font-black tabular-nums">{dimensions.length}</span>
                            )}
                        </button>
                        {isDimensionsModalOpen && (
                            <div className="fixed sm:absolute top-auto mt-9 left-3 sm:left-0 w-64 bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden z-50 flex flex-col p-2 gap-1 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest">Grouping Dimensions</div>
                                    <div className="text-[9px] font-medium text-slate-800 leading-tight mt-0.5 italic">Select dimensions then click 'Fetch' to update.</div>
                                </div>
                                {[
                                    { id: "clientIP", label: "IP Address", desc: "Source IP address" },
                                    { id: "clientAsn", label: "ASN Network", desc: "Autonomous System Number", pro: true },
                                    { id: "clientCountryName", label: "Country", desc: "Geographic Location" },
                                    { id: "clientRequestPath", label: "Request Path", desc: "URL Route Path" },
                                    { id: "clientRequestHTTPHost", label: "HTTP Host", desc: "Target Hostname" },
                                    { id: "clientRequestHTTPMethodName", label: "HTTP Method", desc: "GET, POST, etc." },
                                    { id: "edgeResponseStatus", label: "HTTP Status", desc: "Response status code" },
                                    { id: "clientDeviceType", label: "Device Type", desc: "Mobile, Desktop, Tablet" },
                                    { id: "userAgentBrowser", label: "Browser", desc: "Detected User Agent Browser" },
                                    { id: "userAgentOS", label: "OS", desc: "Detected Operating System" },
                                    { id: "clientRefererHost", label: "Referer Host", desc: "Source referer hostname", pro: true },
                                    { id: "coloCode", label: "Datacenter", desc: "Cloudflare Edge Location", pro: true },
                                    { id: "clientRequestHTTPProtocol", label: "HTTP Version", desc: "HTTP/1.1, HTTP/2, etc." }
                                ].map(opt => {
                                    const isChecked = dimensions.includes(opt.id);
                                    return (
                                        <label key={opt.id} className={`flex items-start gap-3 px-3 py-2 border rounded-md transition-all cursor-pointer ${isChecked ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}>
                                            <div className="pt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setDimensions([...dimensions, opt.id]);
                                                        else setDimensions(dimensions.filter(d => d !== opt.id));
                                                    }}
                                                    className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <span className={`flex items-center text-[12px] font-bold ${isChecked ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                    {opt.label}
                                                    {opt.pro && (
                                                        <svg className="w-3 h-3 text-indigo-400 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span className={`text-[10px] font-medium leading-tight mt-0.5 ${isChecked ? 'text-indigo-600/70' : 'text-slate-400'}`}>{opt.desc}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Zone select */}
                    <div className="relative shrink-0 flex items-center">
                        {!activeZoneId && (
                            <div className="absolute left-2.5 z-10 pointer-events-none text-amber-500 animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                        )}
                        <select
                            value={activeZoneId}
                            onChange={(e) => onActiveZoneChange(e.target.value)}
                            className={`${inputCls} relative w-auto max-w-[180px] h-[34px] ${!activeZoneId ? 'pl-7 pr-8 border-amber-300 bg-amber-50/30 text-amber-900 ring-1 ring-amber-200' : 'px-2 border-slate-200 text-slate-900'} text-[10px] font-bold bg-white min-w-[100px] shadow-sm rounded-md focus:ring-slate-950 transition-all`}
                        >
                            <option value="">Zone...</option>
                            {zones.map(z => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>
                    </div>


                    {/* Separator */}
                    <div className="w-px h-6 bg-slate-200 shrink-0" />

                    {/* Date picker */}
                    <div className="shrink-0">
                        <DateRangePicker
                            value={dateRange}
                            onChange={onDateRangeChange}
                            isLoading={isGlobalLoading || isLoading}
                            liveLabel="Live Logs"
                            align="left"
                        />
                    </div>

                    {/* Separator */}
                    <div className="w-px h-6 bg-slate-200 shrink-0" />

                    {/* Search & Deep Search Group */}
                    <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                        <div className="relative w-full sm:w-[200px] rounded-md border border-slate-200" title="Quick search filters the currently loaded items. Use Deep Search to search all of Cloudflare.">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <svg className="w-3.5 h-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search entries..."
                                value={searchQuery}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchQuery(val);
                                    if (!val.trim() && deepSearchActive) {
                                        handleClearDeepSearch();
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleDeepSearch();
                                    }
                                }}
                                className="block w-full h-[34px] pl-8 pr-3 text-[11px] font-bold bg-white/50 border-0 shadow-none rounded-md focus:ring-slate-950 placeholder:text-slate-400 placeholder:font-medium focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center rounded-md overflow-hidden border border-violet-200/50 shadow-sm h-[34px] bg-violet-50">
                            <button
                                type="button"
                                onClick={handleDeepSearch}
                                disabled={isLoading || !searchQuery.trim()}
                                className="flex items-center justify-center gap-1 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed text-violet-700 hover:text-violet-900 text-[10px] font-black uppercase tracking-wider px-3 h-full transition-colors active:scale-95 whitespace-nowrap focus:outline-none"
                                title="Search all matches directly in Cloudflare Analytics"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
                                </svg>
                                Search
                            </button>
                        </div>
                        {deepSearchActive && (
                            <button
                                type="button"
                                onClick={handleClearDeepSearch}
                                className="flex items-center justify-center text-rose-600 hover:text-rose-800 text-[10px] font-black uppercase px-2 h-[34px] transition-colors"
                                title="Clear deep search filter"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Selection bar — appears when rows are checked */}
                    {selectedItems.size > 0 && (
                        <>
                            <div className="w-px h-6 bg-slate-200 shrink-0 hidden sm:block mx-1" />
                            <ActionSelection
                                selectedCount={selectedItems.size}
                                onClear={() => setSelectedItems(new Set())}
                                placement="bottom"
                                actions={selectionActions}
                            />
                        </>
                    )}

                    {/* Fetch + Limit — right side */}
                    <div className="flex items-center rounded-md overflow-hidden border border-slate-900 shadow-sm ml-auto shrink-0">
                        <button
                            onClick={() => handleFetch()}
                            disabled={!activeZoneId || isLoading}
                            className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold px-3 h-[34px] transition-colors active:scale-95 whitespace-nowrap"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                            )}
                            Fetch
                        </button>
                        <div className="relative bg-slate-50 border-l border-slate-900/10 h-[34px] flex items-center">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={limit}
                                onChange={(e) => onLimitChange(Number(e.target.value))}
                                className="h-full pl-2.5 pr-8 text-[11px] font-bold bg-transparent border-0 shadow-none [appearance:textfield] focus:ring-0 text-slate-900 focus:outline-none"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase pointer-events-none">
                                MAX
                            </span>
                        </div>
                    </div>

                </header>


                <div className="w-full flex-1 flex flex-col">
                    <div className="flex-1 min-h-[500px] w-full">
                        {errorMsg ? (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-6 border border-red-100 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Data Fetch Failed</h3>
                                <p className="text-sm text-slate-500 max-w-md bg-white border border-slate-200 p-4 rounded-md shadow-sm italic break-words">{errorMsg}</p>
                                <button
                                    onClick={() => setErrorMsg(null)}
                                    className="mt-6 text-[11px] font-bold text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-md transition-colors uppercase tracking-tight"
                                >
                                    Dismiss
                                </button>
                            </div>
                        ) : displayResults.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-20 px-12 text-center">
                                <h3 className="text-md font-bold text-slate-700">No matches found</h3>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting your filter or toggling "Deep Query" to search Cloudflare directly.</p>
                            </div>
                        ) : (
                            <div className="relative overflow-x-auto custom-scrollbar bg-white border border-slate-200 shadow-sm ">
                                <table className="w-full min-w-max md:min-w-full text-left border-collapse">
                                    <thead className="bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-20">
                                        <tr>
                                            <th className="px-6 py-5 text-center w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={displayResults.length > 0 && selectedItems.size === displayResults.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const newSelected = new Set<number>();
                                                            displayResults.forEach(item => {
                                                                const idx = results.indexOf(item);
                                                                if (idx !== -1) newSelected.add(idx);
                                                            });
                                                            setSelectedItems(newSelected);
                                                        } else {
                                                            setSelectedItems(new Set());
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20 text-center">Rank</th>

                                            {(dimensions.length > 0 ? dimensions : ["clientIP"]).map(dim => {
                                                const labels: Record<string, string> = {
                                                    clientIP: "IP Address",
                                                    clientAsn: "ASN Network",
                                                    clientCountryName: "Country",
                                                    clientRequestPath: "Request Path",
                                                    clientDeviceType: "Device Type",
                                                    clientRequestHTTPHost: "HTTP Host",
                                                    clientRequestHTTPMethodName: "Method",
                                                    edgeResponseStatus: "Status",
                                                    userAgentBrowser: "Browser",
                                                    userAgentOS: "OS",
                                                    clientRefererHost: "Referer",
                                                    coloCode: "DC",
                                                    clientRequestHTTPProtocol: "Protocol"
                                                };
                                                return (
                                                    <th key={dim} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                        {labels[dim] || dim}
                                                    </th>
                                                );
                                            })}

                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Event Count</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayResults.map((r, i) => {
                                            const originalIdx = results.indexOf(r);
                                            const isSelected = selectedItems.has(originalIdx);
                                            return (
                                                <tr
                                                    key={originalIdx}
                                                    onClick={() => {
                                                        const newSet = new Set(selectedItems);
                                                        if (newSet.has(originalIdx)) newSet.delete(originalIdx);
                                                        else newSet.add(originalIdx);
                                                        setSelectedItems(newSet);
                                                    }}
                                                    className={`transition-all group cursor-pointer ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'}`}
                                                >
                                                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                const newSet = new Set(selectedItems);
                                                                if (e.target.checked) newSet.add(originalIdx);
                                                                else newSet.delete(originalIdx);
                                                                setSelectedItems(newSet);
                                                            }}
                                                            className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-5 text-xs font-black text-slate-300 group-hover:text-slate-500 text-center">
                                                        #{originalIdx + 1}
                                                    </td>
                                                    {(dimensions.length > 0 ? dimensions : ["clientIP"]).map(dim => {
                                                        if (dim === "clientIP") {
                                                            const ipVal = r[dim];
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm group-hover:border-indigo-200 transition-colors">
                                                                        {ipVal || "Unknown"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "clientAsn") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight whitespace-nowrap">
                                                                        AS{r[dim] || "N/A"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "clientCountryName") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 group-hover:bg-white transition-colors uppercase tracking-tight whitespace-nowrap">
                                                                        {r[dim] || "Global"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "clientRequestPath") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-xs font-black text-slate-700 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 font-mono truncate max-w-[200px] inline-block align-bottom">
                                                                        {r[dim] || "Unknown"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "clientDeviceType") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-[10px] font-bold text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-100 italic truncate max-w-[150px] uppercase inline-block align-bottom">
                                                                        {r[dim] || "Unknown"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "clientRequestHTTPHost") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-md italic">
                                                                        {r[dim] || "Unknown"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "edgeResponseStatus") {
                                                            const status = r[dim];
                                                            const color = status >= 500 ? "text-rose-600 bg-rose-50 border-rose-100" :
                                                                status >= 400 ? "text-orange-600 bg-orange-50 border-orange-100" :
                                                                    status >= 300 ? "text-indigo-600 bg-indigo-50 border-indigo-100" :
                                                                        "text-emerald-600 bg-emerald-50 border-emerald-100";
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-md border tabular-nums ${color}`}>
                                                                        {status || "???"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "clientRequestHTTPMethodName") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 uppercase">
                                                                        {r[dim] || "????"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "coloCode") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100 tracking-widest">
                                                                        {r[dim] || "???"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        if (dim === "userAgentBrowser" || dim === "userAgentOS") {
                                                            return (
                                                                <td key={dim} className="px-8 py-5">
                                                                    <span className="text-[10px] font-medium text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md">
                                                                        {r[dim] || "Unknown"}
                                                                    </span>
                                                                </td>
                                                            );
                                                        }
                                                        return <td key={dim} className="px-8 py-5 text-xs text-slate-500 font-medium truncate max-w-[150px]">{r[dim] || "N/A"}</td>;
                                                    })}
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="inline-flex flex-col items-end">
                                                            <span className="text-[13px] font-black tabular-nums tracking-tight bg-gradient-to-br from-indigo-900 to-slate-800 bg-clip-text text-transparent">
                                                                {r.count.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div >

            <IpLookupModal
                isOpen={isIpLookupOpen}
                onClose={() => setIsIpLookupOpen(false)}
                ipAddresses={selectedIps}
                onAddToList={triggerPushIps}
            />

            <PushIpToList
                isOpen={isIpListAddOpen}
                onClose={() => setIsIpListAddOpen(false)}
                onSuccess={() => {
                    setSelectedItems(new Set());
                }}
                selectedIps={ipsToPush}
                selectedItemsSize={ipsToPush.length}
                activeZoneId={activeZoneId}
                zones={zones}
            />
        </>
    );
}
