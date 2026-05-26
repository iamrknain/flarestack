export function MetricsGrid({ zonesCount, activeRulesCount }: { zonesCount: number; totalBlocks: number; activeRulesCount: number; rangeLabel?: string }) {
    const isActive = zonesCount > 0 && activeRulesCount > 0;

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-md shadow-sm">
            {isActive ? (
                <>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 shrink-0">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">Active</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                        Securing <span className="text-indigo-600 tabular-nums">{zonesCount}</span> zone{zonesCount !== 1 ? 's' : ''} using <span className="text-indigo-600 tabular-nums">{activeRulesCount}</span> active rule{activeRulesCount !== 1 ? 's' : ''}
                    </p>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 shrink-0">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest whitespace-nowrap">Inactive</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                        {zonesCount > 0
                            ? "Protection is offline. Enable/Add a rule to begin securing traffic."
                            : "Protection is offline. Add a zone and enable a rule to begin securing traffic."}
                    </p>
                </>
            )}
        </div>
    );
}
