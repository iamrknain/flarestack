import { ModalShell } from "../ui/shared";
import type { ReactNode } from "react";

interface RuleOption {
    type: string;
    name: string;
    description: string;
    enabled: boolean;
    tag: string;
    tagClasses: string;
    icon: ReactNode;
}

const CF_RULES: RuleOption[] = [
    {
        type: "add_ip_to_list",
        name: "Add IP to List",
        description: "Automatically adds IPs to a Cloudflare IP List once they exceed a defined request threshold.",
        enabled: true,
        tag: "Available",
        tagClasses: "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
    },
    {
        type: "under_attack_mode",
        name: "Auto Under Attack Mode",
        description: "Automatically enables Cloudflare Under Attack Mode when traffic spikes, and disables it when traffic normalizes.",
        enabled: true,
        tag: "Available",
        tagClasses: "bg-rose-100 text-rose-700 border-rose-200",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
        ),
    },
    {
        type: "js_challenge",
        name: "Dynamic JS Challenge",
        description: "Issues a JS Challenge to requests matching specific pattern-based signatures.",
        enabled: false,
        tag: "Coming Soon",
        tagClasses: "bg-amber-100 text-amber-700 border-amber-200",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <rect x="3" y="11" width="18" height="10" rx="2" ry="2" /><circle cx="12" cy="15" r="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
    },
    {
        type: "block_country",
        name: "Geographic Block",
        description: "Blocks traffic originating from specific countries.",
        enabled: false,
        tag: "Coming Soon",
        tagClasses: "bg-blue-100 text-blue-700 border-blue-200",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        ),
    },
];

export function RuleSelector({ onClose, onSelect }: {
    onClose: () => void;
    onSelect: (type: string) => void;
}) {
    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-indigo-100"
            title="Select Rule Type"
            subtitle="Choose the type of mitigation rule you want to setup for this zone."
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9Z" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            }
        >
            <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {CF_RULES.map((rule) => {
                    const ContentWrapper = rule.enabled ? "button" : "div";
                    return (
                        <ContentWrapper
                            key={rule.type}
                            onClick={() => rule.enabled ? onSelect(rule.type) : undefined}
                            className={`w-full text-left relative flex flex-col sm:flex-row gap-4 p-4 lg:p-5 rounded-md border transition-all ${rule.enabled
                                ? "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer group"
                                : "bg-slate-50 border-slate-100 opacity-70 cursor-not-allowed"
                            }`}
                        >
                            <div className={`w-12 h-12 shrink-0 rounded-md flex items-center justify-center transition-transform ${rule.enabled ? "bg-slate-50 border border-slate-100 group-hover:scale-105" : "bg-slate-100/50"}`}>
                                {rule.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <h3 className={`font-bold text-base truncate ${rule.enabled ? "text-slate-900 group-hover:text-indigo-600" : "text-slate-700"}`}>
                                        {rule.name}
                                    </h3>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${rule.tagClasses}`}>
                                        {rule.tag}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">{rule.description}</p>
                            </div>
                        </ContentWrapper>
                    );
                })}
            </div>
        </ModalShell>
    );
}
