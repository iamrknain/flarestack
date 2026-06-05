import { useEffect, useState } from "react";
import { ModalShell } from "../ui/shared";

function syntaxHighlight(json: string) {
    if (!json) return "";
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'text-amber-600'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-slate-700 font-bold'; // key
            } else {
                cls = 'text-rose-600'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-emerald-500 font-bold'; // boolean
        } else if (/null/.test(match)) {
            cls = 'text-slate-400'; // null
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

export function IpDetails({
    isOpen,
    onClose,
    ipAddress
}: {
    isOpen: boolean;
    onClose: () => void;
    ipAddress: string | null;
}) {
    const [loading, setLoading] = useState(false);
    const [rawData, setRawData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'summary' | 'json'>('summary');

    useEffect(() => {
        if (!isOpen || !ipAddress) return;

        let isMounted = true;
        setLoading(true);
        setError(null);
        setRawData(null);

        // Fetch IP details from ipapi.co
        fetch(`https://ipapi.co/${ipAddress}/json/`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch IP details");
                const jsonData: any = await res.json();

                if (jsonData.error) throw new Error(jsonData.reason || "Invalid request");

                if (isMounted) {
                    // Store the raw object so we can render it
                    setRawData(jsonData);
                }
            })
            .catch((err: any) => {
                console.error("IP Lookup error:", err);
                // Fallback
                fetch(`https://freeipapi.com/api/json/${ipAddress}`)
                    .then(res => res.json())
                    .then((fallbackData: any) => {
                        if (isMounted) {
                            setRawData(fallbackData);
                        }
                    })
                    .catch((fallbackErr: any) => {
                        if (isMounted) setError(err.message || "Failed to retrieve IP details.");
                    });
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, ipAddress]);

    if (!isOpen || !ipAddress) return null;

    // Helper to get lat/lon cleanly whether from ipapi.co (latitude) or freeipapi (lat)
    const lat = rawData?.latitude ?? rawData?.lat;
    const lon = rawData?.longitude ?? rawData?.lon;

    return (
        <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center gap-4 px-6 pt-6 pb-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                            <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight truncate">{ipAddress}</h3>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest shrink-0">Lookup Detail</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-tight text-balance">
                            Fetched directly from ipapi.co. Includes geographical map projection.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 bg-white min-h-[400px] relative">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/80 z-10 backdrop-blur-sm">
                            <div className="p-3 bg-white border border-slate-200 shadow-sm rounded-xl">
                                <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                            <span className="text-[13px] font-bold text-slate-500 animate-pulse">Running full WHOIS scan...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-center">
                            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-500 border border-rose-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            </div>
                            <h4 className="text-[14px] font-bold text-slate-900 mb-1">Lookup Failed</h4>
                            <p className="text-[12px] text-slate-500 max-w-[280px] leading-relaxed">{error}</p>
                        </div>
                    ) : rawData ? (
                        <div className="flex flex-col md:flex-row gap-6 h-[450px]">
                            {/* Data viewer */}
                            <div className="flex-1 bg-[#FAFAFA] border border-slate-200 shadow-inner rounded-xl overflow-hidden flex flex-col">
                                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Metadata Context</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">JSON</span>
                                        <button
                                            onClick={() => setViewMode(prev => prev === 'json' ? 'summary' : 'json')}
                                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${viewMode === 'summary' ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${viewMode === 'summary' ? 'translate-x-4' : 'translate-x-1'}`} />
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">List</span>
                                    </div>
                                </div>
                                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 relative">
                                    {viewMode === 'json' ? (
                                        <pre
                                            className="text-[12px] font-mono leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: syntaxHighlight(JSON.stringify(rawData, null, 2)) }}
                                        />
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                            {Object.entries(rawData).map(([key, value]) => (
                                                <div key={key} className="flex flex-col border-b border-slate-100 pb-1">
                                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{key.replace(/_/g, ' ')}</span>
                                                    <span className="text-[12px] font-medium text-slate-800 break-words">
                                                        {value === null ? 'null' : typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Map renderer */}
                            <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center">
                                {lat && lon ? (
                                    <>
                                        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-slate-200/50 flex flex-col">
                                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Coordinates</span>
                                            <span className="text-[11px] font-mono font-bold text-slate-800">{lat}, {lon}</span>
                                        </div>
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            frameBorder={0}
                                            scrolling="no"
                                            marginHeight={0}
                                            marginWidth={0}
                                            className="brightness-[0.95]"
                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.1},${lat - 0.1},${lon + 0.1},${lat + 0.1}&layer=mapnik&marker=${lat},${lon}`}
                                        />
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                                        <span className="text-xs font-medium">Map projection unavailable</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
