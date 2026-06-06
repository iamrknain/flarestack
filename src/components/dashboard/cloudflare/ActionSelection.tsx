import { useState, useRef, useEffect } from "react";

export interface SelectionAction {
    label: string;
    description?: string;
    icon: React.ReactNode;
    colorTheme?: "violet" | "rose" | "indigo" | "emerald";
    onClick: () => void | Promise<void>;
}

// Preset 1: Copy Selected IP(s)
export const createCopyAction = (
    ips: string[] | Set<string>,
    onSuccess: () => void
): SelectionAction => {
    const list = Array.isArray(ips) ? ips : Array.from(ips);
    return {
        label: "Copy Selected",
        description: `Copy ${list.length} target(s) to clipboard`,
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
        ),
        colorTheme: "emerald",
        onClick: () => {
            navigator.clipboard.writeText(list.join(", "));
            onSuccess();
        }
    };
};

// Preset 2: Delete from Cloudflare
export const createDeleteAction = (
    count: number,
    onConfirmDelete: () => void | Promise<void>,
    isDeleting = false
): SelectionAction => ({
    label: isDeleting ? "Deleting..." : "Delete from Cloudflare",
    description: `Remove ${count} entries`,
    icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-5v6" />
        </svg>
    ),
    colorTheme: "rose",
    onClick: onConfirmDelete
});

// Preset 3: Lookup IP Details
export const createLookupAction = (
    count: number,
    onClick: () => void
): SelectionAction => ({
    label: "Lookup IP Details",
    description: `Inspect ${count} selected IPs`,
    icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
        </svg>
    ),
    colorTheme: "violet",
    onClick
});

// Preset 4: Add IPs to IP List
export const createAddToListAction = (
    count: number,
    onClick: () => void
): SelectionAction => ({
    label: "Add IPs to IP List",
    description: `Push ${count} target(s) to a Cloudflare IP List`,
    icon: (
        <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    colorTheme: "indigo",
    onClick
});

export function ActionSelection({
    selectedCount,
    actions,
    onClear,
    placement = "bottom",
    align = "left"
}: {
    selectedCount: number;
    actions: SelectionAction[];
    onClear?: () => void;
    placement?: "top" | "bottom";
    align?: "left" | "right";
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (selectedCount === 0) return null;

    const getThemeClasses = (theme?: string) => {
        switch (theme) {
            case "rose":
                return {
                    bg: "bg-rose-50 group-hover/item:bg-rose-100",
                    text: "text-rose-600",
                    description: "text-rose-400"
                };
            case "violet":
                return {
                    bg: "bg-violet-50 group-hover/item:bg-violet-100",
                    text: "text-violet-600",
                    description: "text-violet-400"
                };
            case "emerald":
                return {
                    bg: "bg-emerald-50 group-hover/item:bg-emerald-100",
                    text: "text-emerald-600",
                    description: "text-emerald-400"
                };
            case "indigo":
                return {
                    bg: "bg-indigo-50 group-hover/item:bg-indigo-100",
                    text: "text-indigo-600",
                    description: "text-indigo-400"
                };
            default:
                return {
                    bg: "bg-slate-50 group-hover/item:bg-slate-100",
                    text: "text-slate-700",
                    description: "text-slate-400"
                };
        }
    };

    const alignClass = align === "right" ? "right-0" : "left-0";
    const dropdownPositionClass = placement === "top" ? `bottom-full mb-2 ${alignClass}` : `top-full mt-2 ${alignClass}`;

    return (
        <div className="flex flex-wrap items-center gap-2 bg-indigo-50/50 border border-indigo-100/50 py-1 px-3 rounded-md animate-in fade-in duration-300">
            {/* Count */}
            <div className="flex items-center gap-2">
                <span className="bg-white border border-indigo-200 text-indigo-700 text-[11px] font-black px-2 py-0.5 rounded-md tabular-nums shadow-sm select-none">
                    {selectedCount}
                </span>
                <span className="text-[12px] font-bold text-indigo-900 select-none">selected</span>
            </div>

            <div className="w-px h-5 bg-indigo-200/60 mx-1" />

            {/* Dropdown Container */}
            <div className="relative shrink-0 flex items-center gap-2" ref={containerRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 h-[28px] text-[11px] font-bold bg-white border border-indigo-200 hover:border-indigo-300 rounded-md shadow-sm text-indigo-900 hover:bg-slate-50 transition-colors whitespace-nowrap animate-in fade-in duration-150"
                >
                    Action
                    <svg
                        className={`w-3 h-3 text-indigo-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>

                {onClear && (
                    <button
                        onClick={onClear}
                        className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest px-2 transition-colors"
                    >
                        Clear
                    </button>
                )}

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className={`absolute ${dropdownPositionClass} w-56 bg-white rounded-md shadow-xl border border-slate-200 z-50 flex flex-col p-2 gap-0.5 animate-in fade-in zoom-in-95 duration-100`}>
                        <div className="px-3 py-2 border-b border-slate-100 mb-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</div>
                        </div>

                        {actions.map((action, idx) => {
                            const colors = getThemeClasses(action.colorTheme);
                            return (
                                <button
                                    key={idx}
                                    onClick={async () => {
                                        setIsOpen(false);
                                        await action.onClick();
                                    }}
                                    className="flex items-center gap-3 text-left w-full px-3 py-2 rounded-md transition-all hover:bg-slate-50 group/item"
                                >
                                    <div className={`w-6 h-6 rounded-md ${colors.bg} flex items-center justify-center shrink-0`}>
                                        <span className={colors.text}>{action.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-[12px] font-bold ${colors.text}`}>{action.label}</div>
                                        {action.description && (
                                            <div className={`text-[10px] font-medium ${colors.description}`}>{action.description}</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
