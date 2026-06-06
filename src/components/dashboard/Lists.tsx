import { useState, useEffect, useMemo, useRef } from "react";
import { DateRangePicker, type DateRange } from "~/components/DateRangePicker";
import { getListsAction, getListItemsAction, deleteListItemsAction, addListItemsAction } from "~/server/cloudflare";
import { IpLookupModal } from "~/components/dashboard/cloudflare/IpLookupModal";
import { ListActionSelection, createCopyAction, createDeleteAction, createLookupAction } from "~/components/dashboard/cloudflare/ListActionSelection";

const isValueQuery = (query: string): boolean => {
    const trimmed = query.trim();
    if (!trimmed) return true;
    const ipRegex = /^[0-9a-fA-F.:/*\-]*$/;
    const asnRegex = /^(as|AS)?[0-9]+$/;
    const hostRegex = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+$/;
    return ipRegex.test(trimmed) || asnRegex.test(trimmed) || hostRegex.test(trimmed);
};

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
    const [hasAttemptedAutoSelect, setHasAttemptedAutoSelect] = useState(false);
    const [hasLoadedLists, setHasLoadedLists] = useState(false);
    const [selectedListId, setSelectedListId] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("flarestack_lists_selected_id");
        }
        return null;
    });
    const [listItems, setListItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [deepSearchActive, setDeepSearchActive] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [isIpLookupOpen, setIsIpLookupOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addValue, setAddValue] = useState("");
    const [addComment, setAddComment] = useState("");
    const [isAddingItem, setIsAddingItem] = useState(false);

    const handleAddItemSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedListId) return;
        if (!addValue.trim()) return;

        const currentList = lists.find(l => l.id === selectedListId);
        const kind = currentList?.kind || 'ip';

        setIsAddingItem(true);
        try {
            const itemPayload: any = {};
            if (kind === 'ip') itemPayload.ip = addValue.trim();
            else if (kind === 'asn') itemPayload.asn = parseInt(addValue.trim(), 10);
            else if (kind === 'hostname') itemPayload.hostname = addValue.trim();
            else itemPayload.ip = addValue.trim();

            if (addComment.trim()) {
                itemPayload.comment = addComment.trim();
            }

            const res = await addListItemsAction(selectedAccountRef, selectedListId, [itemPayload]);
            if (res && "error" in res) {
                alert(`Add Error: ${res.error}`);
            } else if (res?.success) {
                setAddValue("");
                setAddComment("");
                setIsAddModalOpen(false);
                await handleFetchItems();
            }
        } catch (err: any) {
            alert(`Failed to add item: ${err.message || err}`);
        } finally {
            setIsAddingItem(false);
        }
    };

    const selectedIps = useMemo(() => {
        return listItems
            .filter(item => selectedItemIds.has(item.id))
            .map(item => item.ip || item.asn?.toString() || item.hostname)
            .filter((val): val is string => !!val);
    }, [listItems, selectedItemIds]);

    const selectedItemsSizeRef = useRef(selectedItemIds.size);

    useEffect(() => {
        selectedItemsSizeRef.current = selectedItemIds.size;
    }, [selectedItemIds.size]);

    // Persist selections
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("flarestack_lists_account_id", selectedAccountRef);
            if (selectedListId) {
                localStorage.setItem("flarestack_lists_selected_id", selectedListId);
            }
        }
    }, [selectedAccountRef, selectedListId]);

    // Validate selectedAccountRef against accounts
    useEffect(() => {
        if (accounts.length > 0) {
            const isValid = accounts.some(acc => acc.id === selectedAccountRef);
            if (!isValid) {
                setSelectedAccountRef(accounts[0].id);
            }
        } else {
            setSelectedAccountRef("");
        }
    }, [accounts, selectedAccountRef]);

    // Validate selectedListId against fetched lists
    useEffect(() => {
        if (lists.length > 0) {
            const isValid = lists.some(list => list.id === selectedListId);
            if (!isValid) {
                setSelectedListId(lists[0].id);
            }
        } else {
            setSelectedListId(null);
        }
    }, [lists, selectedListId]);

    // Auto-select the first account that actually has lists
    useEffect(() => {
        if (accounts.length <= 1 || hasAttemptedAutoSelect || listsLoading || !hasLoadedLists) return;
        
        async function findFirstAccountWithLists() {
            setHasAttemptedAutoSelect(true);
            if (lists.length > 0) return;
            
            for (const acc of accounts) {
                if (acc.id === selectedAccountRef) continue;
                try {
                    const data = await getListsAction(acc.id);
                    if (data && !("error" in data) && data.length > 0) {
                        setSelectedAccountRef(acc.id);
                        setLists(data);
                        setHasLoadedLists(true);
                        return;
                    }
                } catch (e) {
                    console.error("Auto-select list check failed:", e);
                }
            }
        }
        
        if (selectedAccountRef && lists.length === 0) {
            findFirstAccountWithLists();
        }
    }, [accounts, lists, listsLoading, hasLoadedLists, selectedAccountRef, hasAttemptedAutoSelect]);

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
                setHasLoadedLists(true);
            }
        } catch (e) {
            console.error("Fetch lists error:", e);
        } finally {
            setListsLoading(false);
        }
    };

    const handleFetchItems = async (isDeep = deepSearchActive, query = searchQuery) => {
        if (!selectedListId || !selectedAccountRef) return;
        setItemsLoading(true);
        try {
            const fetchLimit = isDeep ? undefined : limit;
            const isIpPrefix = /^[a-fA-F0-9.:]+$/.test(query.trim());
            const searchParam = (isDeep && isIpPrefix) ? query.trim() : undefined;

            const data = await getListItemsAction(selectedAccountRef, selectedListId, fetchLimit, searchParam);
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

    const handleDeepSearch = async () => {
        setDeepSearchActive(true);
        await handleFetchItems(true, searchQuery);
    };

    const handleClearDeepSearch = async () => {
        setDeepSearchActive(false);
        setItemsLoading(true);
        try {
            const data = await getListItemsAction(selectedAccountRef, selectedListId!, limit);
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
        setLists([]);
        setSelectedListId(null);
        setListItems([]);
        setSelectedItemIds(new Set());
        setHasLoadedLists(false);
        handleFetchLists();
    }, [selectedAccountRef]);

    // Reset selected items when list changes
    useEffect(() => {
        setSelectedItemIds(new Set());
    }, [selectedListId]);

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

    const selectedList = useMemo(() => {
        return lists.find(l => l.id === selectedListId);
    }, [lists, selectedListId]);
    const isIpList = selectedList?.kind === 'ip';

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

        // Sort by Date Added (latest first)
        items = [...items].sort((a, b) => {
            const timeA = a.created_on ? new Date(a.created_on).getTime() : 0;
            const timeB = b.created_on ? new Date(b.created_on).getTime() : 0;
            return timeB - timeA;
        });

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
        if (!confirm(`Are you sure you want to delete ${ids.length} selected entries from the Cloudflare list?`)) return;

        setDeleteLoading(true);
        try {
            const ips = listItems
                .filter(item => ids.includes(item.id))
                .map(item => item.ip)
                .filter((ip): ip is string => !!ip);

            const data = await deleteListItemsAction(selectedAccountRef, selectedListId!, ids, ips);
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
        }
    };

    const handleBulkDeleteByIps = async (ips: string[]) => {
        const cleanInputIps = ips.map(ip => ip.split("/")[0].trim());
        const idsToDelete = listItems
            .filter(item => {
                const itemIp = item.ip || item.asn?.toString() || item.hostname;
                if (!itemIp) return false;
                const cleanItemIp = itemIp.split("/")[0].trim();
                return cleanInputIps.includes(cleanItemIp);
            })
            .map(item => item.id);
        
        if (idsToDelete.length === 0) {
            alert(`No matching items found in local list to delete.\nInput IPs: ${JSON.stringify(cleanInputIps)}\nAvailable items: ${JSON.stringify(listItems.map(i => i.ip || i.asn || i.hostname))}`);
            return;
        }

        try {
            const mappedIps = listItems
                .filter(item => idsToDelete.includes(item.id))
                .map(item => item.ip)
                .filter((ip): ip is string => !!ip);

            const data = await deleteListItemsAction(selectedAccountRef, selectedListId!, idsToDelete, mappedIps);
            if (data && "error" in data) {
                alert(`Delete API Error: ${data.error}`);
                throw new Error(data.error);
            } else if (data?.success) {
                alert(`Successfully deleted ${idsToDelete.length} item(s) from Cloudflare!`);
                await handleFetchItems();
                setSelectedItemIds(prev => {
                    const next = new Set(prev);
                    idsToDelete.forEach(id => next.delete(id));
                    return next;
                });
            }
        } catch (e: any) {
            alert(`Delete Exception: ${e.message || e}`);
            throw e;
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
                            className="block w-full h-[34px] pl-8 pr-3 text-[11px] font-bold bg-white/50 border-0 shadow-none rounded-md focus:ring-slate-950 placeholder:text-slate-400 placeholder:font-medium focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center rounded-md overflow-hidden border border-violet-200/50 shadow-sm h-[34px] bg-violet-50">
                        <button
                            onClick={handleDeepSearch}
                            disabled={itemsLoading || !searchQuery.trim()}
                            className="flex items-center justify-center gap-1 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed text-violet-700 hover:text-violet-900 text-[10px] font-black uppercase tracking-wider px-3 h-full transition-colors active:scale-95 whitespace-nowrap focus:outline-none"
                            title="Search all matches in Cloudflare. Note: IP/value search is fast, but description (comment) search scans all items and takes longer."
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
                            </svg>
                            Deep Search
                        </button>
                        {!isValueQuery(searchQuery) && searchQuery.trim() && (
                            <button
                                type="button"
                                className="flex items-center justify-center w-[30px] h-full bg-amber-50 hover:bg-amber-100 border-l border-violet-200/50 text-amber-700 transition-colors shrink-0 focus:outline-none"
                                title="Note: IP/value search is fast, but description (comment) search scans all items and takes longer."
                                onClick={() => alert("Cloudflare only indexes list items by IP/value. Searching descriptions (comments) requires scanning all pages of items, which can take significantly longer.")}
                            >
                                <svg className="w-4 h-4 shrink-0 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {deepSearchActive && (
                        <button
                            onClick={handleClearDeepSearch}
                            className="flex items-center justify-center text-rose-600 hover:text-rose-800 text-[10px] font-black uppercase px-2 h-[34px] transition-colors"
                            title="Clear deep search filter"
                        >
                            Clear Deep Search
                        </button>
                    )}
                </div>

                <div className="w-px h-6 bg-slate-200 shrink-0 hidden sm:block mx-1" />

                <ListActionSelection
                    selectedCount={selectedItemIds.size}
                    onClear={() => setSelectedItemIds(new Set())}
                    placement="bottom"
                    actions={[
                        createCopyAction(selectedIps, () => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }),
                        createLookupAction(selectedItemIds.size, () => setIsIpLookupOpen(true)),
                        createDeleteAction(selectedItemIds.size, handleBulkDelete, deleteLoading)
                    ]}
                />

                {/* Actions + Limit + Add */}
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    <div className="flex items-center rounded-md overflow-hidden border border-slate-900 shadow-sm">
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

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        disabled={!selectedListId}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold px-3.5 h-[34px] rounded-md transition-all active:scale-95 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                        <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Item
                    </button>
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

            <IpLookupModal
                isOpen={isIpLookupOpen}
                onClose={() => setIsIpLookupOpen(false)}
                ipAddresses={selectedIps}
                onDeleteSelected={handleBulkDeleteByIps}
            />

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 5v14m-7-7h14" />
                                </svg>
                                Add Item to List
                            </h2>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </header>
                        <form onSubmit={handleAddItemSubmit} className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    {(lists.find(l => l.id === selectedListId)?.kind || 'ip').toUpperCase()} Target
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={addValue}
                                    onChange={(e) => setAddValue(e.target.value)}
                                    placeholder={
                                        (lists.find(l => l.id === selectedListId)?.kind || 'ip') === 'ip'
                                            ? 'e.g. 1.1.1.1 or 192.168.1.0/24'
                                            : (lists.find(l => l.id === selectedListId)?.kind || 'ip') === 'asn'
                                            ? 'e.g. 13335'
                                            : 'e.g. example.com'
                                    }
                                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-md py-2 px-3 focus:outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    Comment (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={addComment}
                                    onChange={(e) => setAddComment(e.target.value)}
                                    placeholder="Add description..."
                                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-md py-2 px-3 focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAddingItem || !addValue.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-xs font-bold transition-all active:scale-95 shadow-sm hover:shadow flex items-center gap-1.5"
                                >
                                    {isAddingItem ? (
                                        <>
                                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Adding...
                                        </>
                                    ) : (
                                        'Add to List'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
