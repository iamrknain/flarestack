import { ConnectedAccounts } from "../widgets/ConnectedAccounts";
import { MetricsGrid } from "../widgets/MetricsGrid";
import { ZonesList } from "../widgets/ZonesList";
import { DateRangePicker, type DateRange } from "~/components/shared/DateRangePicker";
import { RecentActions } from "../widgets/RecentActions";

interface OverviewProps {
    dateRange: any;
    onDateRangeChange: (v: any) => void;
    isLoading?: boolean;
    accounts: any[];
    zones: any[];
    rules: any[];
    recentActions: any[];
    totalBlocks: number;
    limit: number;
    onLimitChange: (v: number) => void;
    onRefresh: () => void;
    onAddAccount: () => void;
    onAddZone: () => void;
    onAddRule: (zoneId: string) => void;
    error?: string;
}

export function Overview({
    dateRange,
    onDateRangeChange,
    isLoading,
    accounts,
    zones,
    rules,
    recentActions,
    totalBlocks,
    limit,
    onLimitChange,
    onRefresh,
    onAddAccount,
    onAddZone,
    onAddRule,
    error
}: OverviewProps) {
    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-3 sm:px-4 py-3 flex flex-row flex-wrap gap-2 items-center w-full">
                {/* Main controls (pushed left) */}
                <div className="shrink-0 flex items-center gap-2">
                    <DateRangePicker
                        value={dateRange}
                        onChange={onDateRangeChange}
                        isLoading={isLoading}
                        liveLabel="Live Active"
                        align="left"
                    />

                    {dateRange.live && (
                        <div className="flex items-center gap-1.5 px-2.5 h-[34px] rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
                        </div>
                    )}
                </div>

                {/* Fetch + Control Actions */}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-900 text-[10px] font-bold px-3 h-[34px] border border-slate-200 rounded-md shadow-sm transition-all active:scale-95 whitespace-nowrap"
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

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

                    <button
                        onClick={onAddZone}
                        disabled={accounts.length === 0}
                        className="flex items-center justify-center gap-1.5 bg-slate-950 text-white text-[10px] font-bold px-3 h-[34px] rounded-md hover:bg-black transition-all shadow-sm active:scale-95 disabled:opacity-30 whitespace-nowrap"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Zone
                    </button>
                </div>
            </header>

            <div className="px-3 sm:px-4 flex flex-col gap-6 w-full pb-8">
                <ConnectedAccounts
                    accounts={accounts}
                    onAdd={onAddAccount}
                    error={error}
                />

                <MetricsGrid
                    zonesCount={zones.length}
                    totalBlocks={totalBlocks}
                    activeRulesCount={rules.filter((r: any) => r.isActive).length}
                    rangeLabel={dateRange.type === "all" ? "All Time" : (dateRange.type === "relative" ? `Last ${dateRange.relativeValue}` : "Custom Range")}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ZonesList
                        zones={zones}
                        accounts={accounts}
                        rules={rules}
                        onAddZone={onAddZone}
                        onAddRule={onAddRule}
                    />
                    <div className="relative w-full h-full min-h-[400px]">
                        <div className="absolute inset-0">
                            <RecentActions actions={recentActions} isLive={dateRange.live} zones={zones} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
