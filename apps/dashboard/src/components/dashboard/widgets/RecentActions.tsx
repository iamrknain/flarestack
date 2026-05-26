export function RecentActions({ actions, isLive = false, zones = [] }: { actions: any[], isLive?: boolean, zones?: any[] }) {
    const timeAgo = (dateInput: Date | string) => {
        const time = new Date(dateInput).getTime();
        const diff = Math.floor((Date.now() - time) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    return (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col h-full w-full">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <h2 className="text-sm font-bold text-black uppercase tracking-wider text-slate-900">Recent Actions</h2>
                {isLive && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 text-[10px] font-black uppercase tracking-widest shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        Live Activity
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar divide-y divide-slate-100">
                {actions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <p className="text-sm font-medium italic">No recent actions logged.</p>
                    </div>
                ) : (
                    actions.map((action) => {
                        const zoneName = zones.find(z => z.id === action.zoneConfigId)?.name || "";
                        return (
                            <div key={action.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group">
                                <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                                    <span className="text-[10px] font-bold text-slate-400 w-10 sm:w-12 shrink-0 text-right group-hover:text-slate-500 transition-colors whitespace-nowrap">
                                        {timeAgo(action.timestamp)} ago
                                    </span>

                                    <span className="font-mono text-[11px] text-slate-700 font-bold px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 truncate max-w-[100px] sm:max-w-[140px]">
                                        {action.targetValue}
                                    </span>

                                    {zoneName && (
                                        <span className="text-[9px] font-bold text-slate-500 truncate max-w-[80px] hidden lg:inline-block">
                                            {zoneName}
                                        </span>
                                    )}

                                    <span className="text-[8px] sm:text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0 hidden sm:inline-block">
                                        {action.actionTaken?.replace('_', ' ') || 'ACTION'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-100 px-2 py-0.5 rounded-md shadow-sm">
                                    <span className={`text-[11px] font-black tabular-nums tracking-tight ${action.requestCount ? 'bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent' : 'text-slate-400'}`}>
                                        {action.requestCount ? action.requestCount.toLocaleString() : '—'}
                                    </span>
                                    {action.requestCount && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hits</span>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {actions.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/30 flex justify-center">
                    <a
                        href="/dashboard/logs"
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors group"
                    >
                        View Full History
                        <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </a>
                </div>
            )}
        </div>
    );
}
