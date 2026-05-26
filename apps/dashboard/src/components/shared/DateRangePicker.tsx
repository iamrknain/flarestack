import { useState, useRef, useEffect } from "react";

export type DateRange = {
    type: "relative" | "absolute" | "all";
    relativeValue?: string;
    start?: Date;
    end?: Date;
    live?: boolean;
    refreshInterval?: number; // in seconds
};

interface DateRangePickerProps {
    value: DateRange;
    onChange: (value: DateRange) => void;
    align?: "left" | "right";
    isLoading?: boolean;
    liveLabel?: string;
    showRelative?: boolean;
    showAbsolute?: boolean;
    showLive?: boolean;
}

const PRESETS = [
    { label: "Last 30 minutes", value: "30m" },
    { label: "Last 6 hours", value: "6h" },
    { label: "Last 12 hours", value: "12h" },
    { label: "Last 24 hours", value: "24h" },
    { label: "Last 7 days", value: "7d" },
];

const INTERVALS = [
    { label: "5s", value: 5 },
    { label: "10s", value: 10 },
    { label: "30s", value: 30 },
    { label: "60s", value: 60 },
];

export function DateRangePicker({
    value,
    onChange,
    align = "right",
    isLoading = false,
    liveLabel = "Live Refresh",
    showRelative = true,
    showAbsolute = true,
    showLive = true
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toLocalISO = (date?: Date) => {
        if (!date) return "";
        try {
            const d = new Date(date);
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().slice(0, 16);
        } catch (e) {
            return "";
        }
    };

    const [tempStart, setTempStart] = useState("");
    const [tempEnd, setTempEnd] = useState("");

    useEffect(() => {
        if (isOpen) {
            setTempStart(toLocalISO(value.start || new Date(Date.now() - 30 * 60000)));
            setTempEnd(toLocalISO(value.end || new Date()));
        }
    }, [isOpen, value.start, value.end]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRelativeSelect = (preset: typeof PRESETS[0]) => {
        onChange({ ...value, type: "relative", relativeValue: preset.value });
        setIsOpen(false);
    };

    const handleClearFilter = () => {
        onChange({ ...value, type: "all", relativeValue: undefined, start: undefined, end: undefined });
        setIsOpen(false);
    };

    const handleApplyAbsolute = () => {
        if (tempStart && tempEnd) {
            onChange({
                ...value,
                type: "absolute",
                start: new Date(tempStart),
                end: new Date(tempEnd),
                relativeValue: undefined
            });
            setIsOpen(false);
        }
    };

    const getDisplayLabel = () => {
        if (value.type === "all") return "All Time";
        if (value.type === "relative") {
            return PRESETS.find(p => p.value === value.relativeValue)?.label || "Select range";
        }
        return `${new Date(value.start!).toLocaleDateString()} - ${new Date(value.end!).toLocaleDateString()}`;
    };

    const getTimezone = () => {
        try {
            return `(GMT${new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value})`;
        } catch {
            return "";
        }
    };

    return (
        <div className={`relative ${isOpen ? 'z-[45]' : ''}`} ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2.5 h-10 px-4 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98]"
            >
                <div className="flex items-center gap-2">
                    <svg
                        className={`transition-all duration-500 ${value.live ? "text-emerald-500" : "text-slate-400"} ${isLoading ? "animate-spin" : ""}`}
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                        <path d="M12 6v6l4 2" />
                    </svg>
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                        {getDisplayLabel()}
                    </span>

                    {value.live && (
                        <span className="text-[10px] font-black text-emerald-500 tabular-nums">
                            ({value.refreshInterval}s)
                        </span>
                    )}

                    <div className="w-px h-3 bg-slate-200 hidden sm:block mx-1" />
                    <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
                        {getTimezone()}
                    </span>
                </div>
                <svg className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>

            {isOpen && (
                <div className={`absolute top-full mt-2 z-[45] bg-white border border-slate-200 rounded-md shadow-2xl shadow-slate-900/10 overflow-hidden flex flex-col md:flex-row ${showRelative && showAbsolute ? "min-w-[320px] md:min-w-[500px]" : "min-w-[240px]"} ${align === "right" ? "right-0" : "left-0"}`}>
                    {/* Presets Sidebar */}
                    {showRelative && (
                        <div className="w-full md:w-48 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-100 p-2 flex flex-col gap-1">
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time Presets</div>
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => handleRelativeSelect(preset)}
                                    className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-all text-left ${value.type === "relative" && value.relativeValue === preset.value
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}


                            {showLive && (
                                <div className="mt-auto pt-2 border-t border-slate-100 md:block hidden">
                                    <div className="flex items-center justify-between px-3 py-2">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{liveLabel}</span>
                                        <button
                                            onClick={() => onChange({ ...value, live: !value.live, refreshInterval: value.refreshInterval || 10 })}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value.live ? "bg-emerald-500" : "bg-slate-200"}`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value.live ? "translate-x-5" : "translate-x-0.5"}`} />
                                        </button>
                                    </div>

                                    {value.live && (
                                        <div className="px-3 pb-3 pt-1">
                                            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/80 rounded-lg">
                                                {INTERVALS.map((interval) => (
                                                    <button
                                                        key={interval.value}
                                                        onClick={() => onChange({ ...value, refreshInterval: interval.value })}
                                                        className={`text-[10px] font-bold h-6 rounded-md transition-all ${value.refreshInterval === interval.value
                                                            ? "bg-white text-slate-900 shadow-sm"
                                                            : "text-slate-500 hover:text-slate-700"
                                                            }`}
                                                    >
                                                        {interval.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Range Area */}
                    {showAbsolute && (
                        <div className="flex-1 p-6 flex flex-col gap-6">
                            <button
                                onClick={handleClearFilter}
                                className={`w-full h-11 rounded-xl flex items-center justify-center gap-2.5 transition-all outline-none border ${value.type === "all"
                                    ? "bg-slate-950 text-white border-slate-950 shadow-lg shadow-slate-900/10"
                                    : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 shadow-sm"
                                    }`}
                            >
                                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                <span className="text-[13px] font-bold uppercase tracking-wider">All Time (No Filter)</span>
                            </button>

                            <div className="h-px bg-slate-100 w-full" />

                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Absolute time range</h3>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">From</label>
                                        <div className="relative group">
                                            <input
                                                type="datetime-local"
                                                value={tempStart}
                                                onChange={(e) => setTempStart(e.target.value)}
                                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-950/5 focus:border-slate-950 transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">To</label>
                                        <div className="relative group">
                                            <input
                                                type="datetime-local"
                                                value={tempEnd}
                                                onChange={(e) => setTempEnd(e.target.value)}
                                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-950/5 focus:border-slate-950 transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleApplyAbsolute}
                                disabled={!tempStart || !tempEnd}
                                className={`w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-[0.98] outline-none border ${value.type === "absolute"
                                    ? "bg-slate-950 text-white border-slate-950 shadow-lg shadow-slate-900/10"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-900 hover:text-slate-900 hover:bg-slate-100 shadow-sm"
                                    } disabled:opacity-50 disabled:active:scale-100`}
                            >
                                {value.type === "absolute" ? "Absolute Range Active" : "Apply Custom Range"}
                            </button>

                            {tempStart && tempEnd && (
                                <div className="text-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Duration: {(() => {
                                            const diffMs = new Date(tempEnd).getTime() - new Date(tempStart).getTime();
                                            if (diffMs <= 0) return "Invalid range";
                                            const diffMins = Math.floor(diffMs / 60000);
                                            const days = Math.floor(diffMins / (24 * 60));
                                            const hours = Math.floor((diffMins % (24 * 60)) / 60);
                                            const mins = diffMins % 60;

                                            const parts = [];
                                            if (days > 0) parts.push(`${days}d`);
                                            if (hours > 0) parts.push(`${hours}h`);
                                            if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
                                            return parts.join(" ");
                                        })()}
                                    </span>
                                </div>
                            )}

                            {/* Mobile Live Toggle */}
                            {showLive && (
                                <div className="flex md:hidden flex-col pt-4 border-t border-slate-100 gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{liveLabel}</span>
                                        <button
                                            onClick={() => onChange({ ...value, live: !value.live, refreshInterval: value.refreshInterval || 10 })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value.live ? "bg-emerald-500" : "bg-slate-200"}`}
                                        >
                                            <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform ${value.live ? "translate-x-6" : "translate-x-0.5"}`} />
                                        </button>
                                    </div>

                                    {value.live && (
                                        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100/80 rounded-xl">
                                            {INTERVALS.map((interval) => (
                                                <button
                                                    key={interval.value}
                                                    onClick={() => onChange({ ...value, refreshInterval: interval.value })}
                                                    className={`text-[11px] font-black h-8 rounded-lg transition-all ${value.refreshInterval === interval.value
                                                        ? "bg-white text-slate-950 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-800"
                                                        }`}
                                                >
                                                    {interval.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
