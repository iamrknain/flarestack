import { useState, useEffect, useMemo, useRef } from "react";
import { DateRangePicker, type DateRange } from "~/components/DateRangePicker";
import { getListsAction, getListItemsAction, deleteListItemsAction } from "~/server/cloudflare";

export function Lists({
    accounts,
    dateRange,
    onDateRangeChange,
    limit,
    onLimitChange,
    isLoading: isGlobalLoading,
    onPauseChange
}: {
    accounts: any[];
    dateRange: DateRange;
    onDateRangeChange: (v: DateRange) => void;
    limit: number;
    onLimitChange: (v: number) => void;
    isLoading: boolean;
    onPauseChange?: (v: boolean) => void;
}) {
    const [listsLoading, setListsLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [selectedAccountRef, setSelectedAccountRef] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("flarestack_lists_account_id");
            if (saved) return saved;
        }
        return accounts[0]?.id || "";
    });
    const [lists, setLists] = useState<any[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("flarestack_lists_selected_id");
        }
        return null;
    });
    const [listItems, setListItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
    const actionRef = useRef<HTMLDivElement>(null);
    const selectedItemsSizeRef = useRef(selectedItemIds.size);

    useEffect(() => {
        selectedItemsSizeRef.current = selectedItemIds.size;
    }, [selectedItemIds.size]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (actionRef.current && !actionRef.current.contains(event.target as Node)) {
                setIsActionDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Persist selections
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("flarestack_lists_account_id", selectedAccountRef);
            if (selectedListId) {
                localStorage.setItem("flarestack_lists_selected_id", selectedListId);
            }
        }
    }, [selectedAccountRef, selectedListId]);

    // Unified fetchers
    const handleFetchLists = async () => {
        if (!selectedAccountRef) return;
        setListsLoading(true);
        try {
            const data = await getListsAction(selectedAccountRef);
            if (data && "error" in data) {
                console.error("Fetch lists error:", data.error);
            } else {
                setLists(data);
            }
        } catch (e) {
            console.error("Fetch lists error:", e);
        } finally {
            setListsLoading(false);
        }
    };

    const handleFetchItems = async () => {
        if (!selectedListId || !selectedAccountRef) return;
        setItemsLoading(true);
        try {
            const data = await getListItemsAction(selectedAccountRef, selectedListId, limit);
            if (data && "error" in data) {
                console.error("Fetch items error:", data.error);
            } else {
                setListItems(data);
            }
        } catch (e) {
            console.error("Fetch items error:", e);
        } finally {
            setItemsLoading(false);
        }
    };

    // Fetch lists when account changes
    useEffect(() => {
        handleFetchLists();
    }, [selectedAccountRef]);

    // Auto-fetch items on selection, limit, or live update
    useEffect(() => {
        if (!selectedListId || !selectedAccountRef) {
            setListItems([]);
            return;
        }

        // Only fetch on change if no items are currently selected to avoid UI snapping
        if (selectedItemsSizeRef.current === 0) {
            handleFetchItems();
        }

        if (!dateRange.live) return;

        const intervalMs = (dateRange.refreshInterval || 10) * 1000;
        const timer = setInterval(() => {
            if (!itemsLoading && !listsLoading && selectedItemsSizeRef.current === 0) {
                handleFetchItems();
            }
        }, intervalMs);

        return () => clearInterval(timer);
    }, [selectedListId, selectedAccountRef, limit, dateRange.live]);

    // Notify parent to pause global sync when items are selected
    useEffect(() => {
        onPauseChange?.(selectedItemIds.size > 0);
    }, [selectedItemIds.size, onPauseChange]);

    const startTime = useMemo(() => {
        if (dateRange.type === "all") return null;
        if (dateRange.type === "relative") {
            const val = dateRange.relativeValue || "30m";
            const num = parseInt(val);
            const unit = val.slice(-1);
            let ms = 30 * 60000;
            if (unit === "m") ms = num * 60000;
            else if (unit === "h") ms = num * 3600000;
            else if (unit === "d") ms = num * 86400000;
            return Date.now() - ms;
        } else if (dateRange.start) {
            return dateRange.start.getTime();
        }
        return null;
    }, [dateRange]);

    const filteredItems = useMemo(() => {
        let items = listItems;

        // Filter by Date Range
        if (startTime) {
            items = items.filter(item => new Date(item.created_on).getTime() >= startTime);
        }

        // Filter by Search Query
        if (!searchQuery) return items;
        const q = searchQuery.toLowerCase();
        return items.filter(item =>
            (item.ip?.toLowerCase().includes(q)) ||
            (item.comment?.toLowerCase().includes(q)) ||
            (item.asn?.toString().includes(q)) ||
            (item.hostname?.toLowerCase().includes(q))
        );
    }, [listItems, searchQuery, startTime]);

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedItemIds);
        if (ids.length === 0) return;
        if (!confirm(`Are you sure you want to remove ${ids.length} selected entries?`)) return;

        setDeleteLoading(true);
        try {
            const data = await deleteListItemsAction(selectedAccountRef, selectedListId!, ids);
            if (data && "error" in data) {
                console.error("Delete items error:", data.error);
            } else if (data?.success) {
                await handleFetchItems();
            }
        } catch (e) {
            console.error("Delete items error:", e);
        } finally {
            setDeleteLoading(false);
            setSelectedItemIds(new Set());
            setIsActionDropdownOpen(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedItemIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItemIds(next);
    };

    const toggleAllSelections = () => {
        if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
            setSelectedItemIds(new Set());
        } else {
            setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const isListsLoading = listsLoading;
    const isItemsLoading = itemsLoading;
    const isRefreshing = isListsLoading || isItemsLoading || isGlobalLoading;

    const handleRefresh = () => {
        handleFetchLists();
        handleFetchItems();
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-3 sm:px-4 py-3 flex flex-row flex-wrap gap-2 items-center w-full">
                {/* Account Selection */}
                <select
                    value={selectedAccountRef}
                    onChange={(e) => setSelectedAccountRef(e.target.value)}
                    className="block w-auto max-w-[150px] h-[34px] px-2 text-slate-900 border-slate-200 text-[10px] font-bold bg-white shadow-sm rounded-md focus:ring-slate-950 shrink-0 transition-all"
                >
                    {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.label}</option>
                    ))}
                </select>

                {/* List Selection */}
                <select
                    value={selectedListId || ""}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="block w-auto max-w-[200px] h-[34px] px-2 text-slate-900 border-slate-200 text-[10px] font-bold bg-white shadow-sm rounded-md focus:ring-slate-950 shrink-0 transition-all disabled:opacity-50"
                    disabled={lists.length === 0}
                >
                    <option value="" disabled>Select a list...</option>
                    {lists.map(list => (
                        <option key={list.id} value={list.id}>{list.name} ({list.kind})</option>
                    ))}
                </select>

                <div className="w-px h-6 bg-slate-200 shrink-0 hidden sm:block mx-1" />

                {/* Search */}
                <div className="relative shrink-0 w-full sm:w-[200px] rounded-md border border-slate-200 ">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <svg className="w-3.5 h-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search entries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full h-[34px] pl-8 pr-3 text-[11px] font-bold bg-white/50 border-0 shadow-none rounded-md focus:ring-slate-950 placeholder:text-slate-400 placeholder:font-medium focus:outline-none"
                    />
                </div>

                {/* Date Picker */}
                <div className="shrink-0">
                    <DateRangePicker
                        value={dateRange}
                        onChange={onDateRangeChange}
                        isLoading={isRefreshing}
                        liveLabel="Auto-Sync"
                        align="left"
                    />
                </div>

                <div className="w-px h-6 bg-slate-200 shrink-0 hidden sm:block mx-1" />

                {/* Selection bar — matches TopStatsExplorer */}
                {selectedItemIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 bg-indigo-50/50 border border-indigo-100/50 py-1 px-3 rounded-md animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Count */}
                        <div className="flex items-center gap-2">
                            <span className="bg-white border border-indigo-200 text-indigo-700 text-[11px] font-black px-2 py-0.5 rounded-md tabular-nums shadow-sm select-none">{selectedItemIds.size}</span>
                            <span className="text-[12px] font-bold text-indigo-900 select-none">selected</span>
                        </div>

                        <div className="w-px h-5 bg-indigo-200/60 mx-1" />

                        {/* Action dropdown */}
                        <div className="relative shrink-0 flex items-center gap-2" ref={actionRef}>
                            <button
                                onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                                className="flex items-center gap-2 px-3 h-[28px] text-[11px] font-bold bg-white border border-indigo-200 hover:border-indigo-300 rounded-md shadow-sm text-indigo-900 hover:bg-slate-50 transition-colors whitespace-nowrap"
                            >
                                Action
                                <svg className={`w-3 h-3 text-indigo-400 transition-transform ${isActionDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>

                            <button
                                onClick={() => setSelectedItemIds(new Set())}
                                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest px-2 transition-colors"
                            >
                                Clear
                            </button>

                            {isActionDropdownOpen && (
                                <div className="absolute top-full mt-2 left-0 w-56 bg-white rounded-md shadow-xl border border-slate-200 z-50 flex flex-col p-2 gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</div>
                                    </div>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-3 text-left px-3 py-2 rounded-md transition-all hover:bg-rose-50 group/item"
                                    >
                                        <div className="w-6 h-6 rounded-md bg-rose-50 group-hover/item:bg-rose-100 flex items-center justify-center shrink-0">
                                            <svg className="w-3.5 h-3.5 text-rose-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-5v6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="text-[12px] font-bold text-rose-600">Delete Selected</div>
                                            <div className="text-[10px] text-rose-400 font-medium">Remove {selectedItemIds.size} entries</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions + Limit */}
                <div className="flex items-center rounded-md overflow-hidden border border-slate-900 shadow-sm ml-auto shrink-0">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold px-3 h-[34px] transition-colors active:scale-95 whitespace-nowrap"
                    >
                        {isRefreshing ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
                            </svg>
                        )}
                        Sync
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

            <main className="px-3 sm:px-4">
                {selectedListId ? (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredItems.length > 0 && selectedItemIds.size === filteredItems.length}
                                                onChange={toggleAllSelections}
                                                className="w-4 h-4 rounded-md border-slate-200 text-slate-950 focus:ring-slate-950 cursor-pointer"
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Entry Value</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Comment</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Date Added</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isItemsLoading && listItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                                <span className="text-[11px] font-bold text-slate-400 italic">Syncing with Cloudflare...</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.length === 0 && !isItemsLoading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center py-12 px-12 text-center group">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 transition-all group-hover:scale-110 duration-500 shadow-sm relative mx-auto">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                                                        <rect width="7" height="7" x="3" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="14" rx="1.5" /><rect width="7" height="7" x="3" y="14" rx="1.5" />
                                                    </svg>
                                                    <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl animate-pulse" />
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight italic">No entries found</h3>

                                                <div className="mt-8 text-left bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-md w-full mx-auto">
                                                    <p className="text-[13px] font-bold text-slate-700 mb-4">Why am I seeing this?</p>
                                                    <ul className="text-[11px] text-slate-500 font-medium space-y-3">
                                                        <li className="flex items-start gap-3">
                                                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                            <span><strong className="text-slate-700">Time Range:</strong> Entries might have been added outside your current selection. Try selecting <strong>"All Time"</strong> or expanding the relative range.</span>
                                                        </li>
                                                        <li className="flex items-start gap-3">
                                                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg>
                                                            <span><strong className="text-slate-700">Search Filtering:</strong> Your current search criteria might be filtering out all available records from the latest batch.</span>
                                                        </li>
                                                        <li className="flex items-start gap-3">
                                                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                                            <span><strong className="text-slate-700">Fetch Limit:</strong> We only fetch the latest <strong>{limit}</strong> items. If the entries you're looking for are older, try increasing the <strong>MAX</strong> limit.</span>
                                                        </li>
                                                        <li className="flex items-start gap-3">
                                                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
                                                            <span><strong className="text-slate-700">Sync Data:</strong> Ensure you have the absolute latest state from Cloudflare by clicking the <strong>"Sync"</strong> button.</span>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.map(item => (
                                    <tr
                                        key={item.id}
                                        className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${selectedItemIds.has(item.id) ? "bg-indigo-50/30" : ""}`}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItemIds.has(item.id)}
                                                    onChange={() => toggleSelection(item.id)}
                                                    className="w-4 h-4 rounded-md border-slate-200 text-slate-950 focus:ring-slate-950 cursor-pointer"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm group-hover:border-indigo-200 transition-colors">
                                                {item.ip || item.asn || item.hostname || item.redirect?.source_url || "Unknown"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[11px] font-medium text-slate-600 block">
                                                {item.comment || <span className="text-slate-300 italic font-normal">No comment</span>}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                                {new Date(item.created_on).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-40 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-8 shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 relative z-10 transition-transform duration-500 group-hover:scale-110">
                                <rect width="7" height="7" x="3" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="14" rx="1.5" /><rect width="7" height="7" x="3" y="14" rx="1.5" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Choose a list to explore</h3>
                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                            Select one of your accounts and a specific list from the header to view and manage its items.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
