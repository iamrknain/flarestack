"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { LogsTable } from "./LogsTable";
import { DateRangePicker, type DateRange } from "~/components/DateRangePicker";
import { deleteActionLogsAction } from "~/server/logs";

const inputCls = "block w-full rounded-md border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 shadow-sm transition-colors text-slate-900";

interface ActionLogsProps {
    zones: any[];
    projects?: any[];
    dateRange: DateRange;
    onDateRangeChange: (v: DateRange) => void;
    limit: number;
    onLimitChange: (v: number) => void;
    isLoading?: boolean;
    recentActions: any[];
    activeZoneId: string;
    onActiveZoneChange: (v: string) => void;
    onRefresh: () => void;
    searchQuery: string;
    onSearchQueryChange: (v: string) => void;
    deepSearchActive: boolean;
    onDeepSearch: () => void;
    onClearDeepSearch: () => void;
    onSelectionChange?: (count: number) => void;
}

export function ActionLogs({
    zones,
    projects = [],
    dateRange,
    onDateRangeChange,
    limit,
    onLimitChange,
    isLoading,
    recentActions,
    activeZoneId,
    onActiveZoneChange,
    onRefresh,
    searchQuery,
    onSearchQueryChange,
    deepSearchActive,
    onDeepSearch,
    onClearDeepSearch,
    onSelectionChange
}: ActionLogsProps) {
    const isFetching = !!isLoading;
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedIds([]);
    }, [recentActions]);

    useEffect(() => {
        onSelectionChange?.(selectedIds.length);
    }, [selectedIds, onSelectionChange]);

    const displayedResults = useMemo(() => {
        if (!searchQuery.trim()) return recentActions;
        const q = searchQuery.toLowerCase();
        return recentActions.filter(log =>
            (log.provider && log.provider.toLowerCase().includes(q)) ||
            (log.resourceId && log.resourceId.toLowerCase().includes(q)) ||
            (log.ruleId && log.ruleId.toLowerCase().includes(q)) ||
            (log.actionTaken && log.actionTaken.toLowerCase().includes(q)) ||
            (log.targetType && log.targetType.toLowerCase().includes(q)) ||
            (log.targetValue && log.targetValue.toLowerCase().includes(q)) ||
            (log.metadata && log.metadata.toLowerCase().includes(q))
        );
    }, [recentActions, searchQuery]);

    const allSelected = displayedResults.length > 0 && displayedResults.every(log => selectedIds.includes(log.id));

    const handleToggleSelectAll = () => {
        if (allSelected) {
            const displayedIds = displayedResults.map(l => l.id);
            setSelectedIds(prev => prev.filter(id => !displayedIds.includes(id)));
        } else {
            const displayedIds = displayedResults.map(l => l.id);
            setSelectedIds(prev => {
                const unique = new Set([...prev, ...displayedIds]);
                return Array.from(unique);
            });
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected log(s)?`)) return;

        try {
            const res = await deleteActionLogsAction(selectedIds);
            if (res && "error" in res && res.error) {
                alert(res.error);
            } else {
                setSelectedIds([]);
                onRefresh();
            }
        } catch (err: any) {
            alert(err.message || "Failed to delete action logs");
        }
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-3 sm:px-4 py-3 flex flex-row flex-wrap gap-2 items-center w-full">

                {/* Zone select (All Zones is valid here) */}
                <select
                    value={activeZoneId}
                    onChange={(e) => onActiveZoneChange(e.target.value)}
                    className={`block w-auto max-w-[180px] h-[34px] px-2 text-slate-900 border-slate-200 text-[10px] font-bold bg-white min-w-[100px] shadow-sm rounded-md focus:ring-slate-950 shrink-0 transition-all`}
                >
                    <option value="">All Zones</option>
                    {zones?.map(z => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                </select>

                {/* Date picker */}
                <div className="shrink-0">
                    <DateRangePicker
                        value={dateRange}
                        onChange={onDateRangeChange}
                        isLoading={isFetching}
                        liveLabel="Live Logs"
                        align="left"
                    />
                </div>

                <div className="w-px h-6 bg-slate-200 shrink-0 hidden sm:block" />

                {/* Search & Deep Search Group */}
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                    <div className="relative w-full sm:w-[220px] rounded-md border border-slate-200 ">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <svg className="w-3.5 h-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search Target, Rule ID..."
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            className={`${inputCls} h-[34px] pl-8 pr-3 text-[11px] font-bold bg-white/50 border-slate-200 shadow-sm rounded-md focus:ring-slate-950 placeholder:text-slate-400 placeholder:font-medium`}
                        />
                    </div>
                    <button
                        onClick={onDeepSearch}
                        disabled={isFetching || !searchQuery.trim()}
                        className="flex items-center justify-center gap-1 bg-violet-50 hover:bg-violet-100 border border-violet-200/50 text-violet-700 hover:text-violet-900 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider px-3 h-[34px] rounded-md transition-all active:scale-95 shadow-sm whitespace-nowrap"
                        title="Search directly in the database"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
                        </svg>
                        Deep Search
                    </button>
                    {deepSearchActive && (
                        <button
                            onClick={onClearDeepSearch}
                            className="flex items-center justify-center text-rose-600 hover:text-rose-800 text-[10px] font-black uppercase px-2 h-[34px] transition-colors"
                            title="Clear server search filter"
                        >
                            Clear DB Filter
                        </button>
                    )}
                </div>

                {selectedIds.length > 0 && (
                    <button
                        onClick={handleDeleteSelected}
                        className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider px-3 h-[34px] rounded-md transition-all active:scale-95 whitespace-nowrap shadow-sm shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        Delete Selected ({selectedIds.length})
                    </button>
                )}

                {/* Fetch + Limit — right side */}
                <div className="flex items-center rounded-md overflow-hidden border border-slate-900 shadow-sm ml-auto shrink-0">
                    <button
                        onClick={onRefresh}
                        disabled={isFetching}
                        className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold px-3 h-[34px] transition-colors active:scale-95 whitespace-nowrap"
                    >
                        {isFetching ? (
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
                    <LogsTable
                        logs={displayedResults}
                        zones={zones}
                        projects={projects}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={handleToggleSelectAll}
                        allSelected={allSelected}
                    />
                </div>
            </div>
        </div>
    );
}
