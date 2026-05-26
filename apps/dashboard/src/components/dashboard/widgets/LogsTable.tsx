export function LogsTable({ logs, zones = [] }: { logs: any[], zones?: any[] }) {
    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date);
    };

    const formatDateFull = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    };

    if (logs.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center py-32 px-12 text-center group">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 transition-all group-hover:scale-110 duration-500 shadow-sm relative mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                    <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight italic">No logs found</h3>
                <div className="mt-5 text-left bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-sm w-full mx-auto">
                    <p className="text-[13px] font-bold text-slate-700 mb-3">Why am I seeing this?</p>
                    <ul className="text-xs text-slate-500 font-medium space-y-2.5">
                        <li className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            <span><strong className="text-slate-700">Time Range:</strong> There genuinely might be no rule-triggering activity in the current time frame. Try shifting the absolute date back or expanding the relative range.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                            <span><strong className="text-slate-700">Zone Restriction:</strong> You might be filtering by a specific zone that hasn't triggered any rules recently. Try switching the dropdown to "All Zones".</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg>
                            <span><strong className="text-slate-700">Search Query:</strong> If you've typed a search term (like a specific IP or Rule ID), it may not exist in the currently fetched log batch.</span>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-x-auto custom-scrollbar bg-white border border-slate-200 shadow-sm ">
            <table className="w-full min-w-max text-left border-collapse">
                <thead className="bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Timestamp</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Target</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Zone</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Action</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Hits</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => {
                        const metadata = log.metadata ? JSON.parse(log.metadata) : {};
                        const date = new Date(log.timestamp);
                        const zoneName = zones.find(z => z.id === log.zoneConfigId)?.name || "Unknown Zone";
                        return (
                            <tr key={log.id} className="transition-all group cursor-pointer hover:bg-slate-50/80">
                                <td className="px-6 py-5">
                                    <div className="text-xs font-bold text-slate-700">{formatDate(date)}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{formatDateFull(date)}</div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm group-hover:border-indigo-400 transition-colors whitespace-nowrap inline-block w-max">
                                            {log.targetValue}
                                        </span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{log.targetType}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{zoneName}</span>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                            {log.actionTaken.replace('_', ' ')}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex flex-col items-start gap-0.5">
                                        <span className={`text-[13px] font-black tabular-nums tracking-tight ${log.requestCount ? 'bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent' : 'text-slate-400'}`}>
                                            {log.requestCount ? log.requestCount.toLocaleString() : '—'}
                                        </span>
                                        {log.requestCount && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Hits</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="max-w-[300px] w-full bg-slate-50 border border-slate-200 rounded-md overflow-hidden flex flex-col shadow-sm">
                                        <div className="bg-slate-100/80 border-b border-slate-200 px-2 py-1 flex items-center justify-between shrink-0">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Metadata</span>
                                            <span className="text-[9px] font-mono font-medium text-slate-400 truncate ml-2" title={log.ruleId}>
                                                ID: {log.ruleId.slice(0, 8)}...
                                            </span>
                                        </div>
                                        <div className="p-2 overflow-auto custom-scrollbar max-h-[80px]">
                                            <pre className="text-[10px] font-mono text-slate-600 m-0">
                                                {Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : '{}'}
                                            </pre>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
