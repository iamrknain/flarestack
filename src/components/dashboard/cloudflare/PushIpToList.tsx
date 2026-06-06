import { useState, useEffect } from "react";
import { getListsAction, addListItemsAction } from "~/server/cloudflare";

export function PushIpToList({
    isOpen,
    onClose,
    onSuccess,
    selectedIps,
    selectedItemsSize,
    activeZoneId,
    zones
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    selectedIps: string[];
    selectedItemsSize: number;
    activeZoneId: string;
    zones: any[];
}) {
    const [selectedIpListId, setSelectedIpListId] = useState("");
    const [availableIpLists, setAvailableIpLists] = useState<any[]>([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);
    const [isAddingItems, setIsAddingItems] = useState(false);
    const [ipListAddResult, setIpListAddResult] = useState<{ success?: boolean; added?: number; error?: string } | null>(null);

    // Fetch CF IP lists when the modal opens
    useEffect(() => {
        if (!isOpen || !activeZoneId) return;
        setIpListAddResult(null); // clear previous feedback
        const zone = zones.find(z => z.id === activeZoneId);
        if (!zone) return;

        setIsLoadingLists(true);
        getListsAction(zone.cfAccountRef)
            .then(data => {
                if (Array.isArray(data)) {
                    setAvailableIpLists(data.filter((l: any) => l.kind === "ip"));
                } else if (data && "error" in data) {
                    console.error("Fetch lists error:", data.error);
                }
            })
            .catch(err => console.error("Fetch lists error:", err))
            .finally(() => setIsLoadingLists(false));
    }, [isOpen, activeZoneId, zones]);

    const handleIpListAdd = () => {
        const zone = zones.find(z => z.id === activeZoneId);
        if (!zone || !selectedIpListId) return;

        const items = selectedIps.filter(Boolean).map(ip => ({ ip }));
        if (items.length === 0) return;

        setIsAddingItems(true);
        addListItemsAction(zone.cfAccountRef, selectedIpListId, items)
            .then(data => {
                if ("error" in data) {
                    setIpListAddResult({ error: data.error });
                } else {
                    setIpListAddResult(data);
                    if (data?.success) {
                        setTimeout(() => {
                            onSuccess();
                            onClose();
                            setSelectedIpListId("");
                            setIpListAddResult(null);
                        }, 1500);
                    }
                }
            })
            .catch(err => {
                console.error("Add list items error:", err);
                setIpListAddResult({ error: "Failed to connect to Cloudflare API" });
            })
            .finally(() => setIsAddingItems(false));
    };

    if (!isOpen) return null;

    return (
        <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-md animate-in zoom-in-95 duration-200">

                {/* Modal header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="w-9 h-9 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    <div>
                        <h3 className="text-[14px] font-black text-slate-900">Add IPs to IP List</h3>
                        <p className="text-[11px] text-slate-400 font-medium">Push selected IPs into a Cloudflare IP List</p>
                    </div>
                    <button onClick={() => { onClose(); setSelectedIpListId(""); }} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">

                    {/* Selected IPs preview */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">IPs to add ({selectedIps.length})</p>
                        {selectedItemsSize > selectedIps.length && (
                            <p className="mb-2 text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-100 px-2 py-1.5 rounded-md">
                                ⚠ {selectedItemsSize - selectedIps.length} selected row(s) have no <code className="bg-amber-100 px-1 rounded">clientIP</code> and will be skipped. Make sure <strong>clientIP</strong> is an active dimension.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-md max-h-28 overflow-y-auto">
                            {selectedIps.length > 0 ? selectedIps.map(ip => (
                                <span key={ip} className="font-mono text-[11px] font-bold bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md shadow-sm">{ip}</span>
                            )) : (
                                <span className="text-[11px] text-amber-600 font-medium italic">No rows with a <code className="bg-amber-50 px-1 rounded">clientIP</code> dimension are selected.</span>
                            )}
                        </div>
                    </div>
 
                    {/* CF IP List selector */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Target Cloudflare IP List</label>
                        {isLoadingLists ? (
                            <div className="flex items-center gap-2 h-[36px] text-[12px] text-slate-400 font-medium">
                                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                Fetching IP Lists from Cloudflare...
                            </div>
                        ) : (
                            <select
                                value={selectedIpListId}
                                onChange={e => setSelectedIpListId(e.target.value)}
                                className="w-full h-[36px] px-3 text-[12px] font-bold bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            >
                                <option value="">{availableIpLists.length === 0 ? "No IP lists found" : "Select an IP list..."}</option>
                                {availableIpLists.map((l: any) => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.id.slice(0, 8)}…)</option>
                                ))}
                            </select>
                        )}
                        {availableIpLists.length === 0 && !isLoadingLists && (
                            <p className="mt-1.5 text-[10px] text-rose-500 font-medium italic">No IP lists found. Go to Cloudflare → Account → Lists to create one.</p>
                        )}
                    </div>
 
                    {/* Error */}
                    {ipListAddResult?.error && (
                        <p className="text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-3 py-2 rounded-md">✖ {ipListAddResult.error}</p>
                    )}

                    {/* Success */}
                    {ipListAddResult?.success && (
                        <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-md">✓ {ipListAddResult.added} IP(s) added successfully!</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 flex items-center justify-end gap-2">
                    <button
                        onClick={() => { onClose(); setSelectedIpListId(""); }}
                        className="px-4 py-2 text-[12px] font-bold text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleIpListAdd}
                        disabled={!selectedIpListId || selectedIps.length === 0 || isAddingItems}
                        className="flex items-center gap-2 px-4 py-2 text-[12px] font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors shadow-sm"
                    >
                        {isAddingItems ? (
                            <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Adding...</>
                        ) : (
                            <>Add {selectedIps.length} IP{selectedIps.length !== 1 ? "s" : ""} to List</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
