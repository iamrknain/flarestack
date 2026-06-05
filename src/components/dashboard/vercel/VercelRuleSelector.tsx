import { ModalShell } from "../ui/shared";
import type { ReactNode } from "react";

interface RuleOption {
    type: string;
    name: string;
    description: string;
    tag: string;
    tagClasses: string;
    icon: ReactNode;
}

const VERCEL_RULES: RuleOption[] = [
    {
        type: "vercel_under_attack_mode",
        name: "Vercel Auto Attack Mode",
        description: "Automatically enables Vercel Under Attack Mode when direct traffic spikes.",
        tag: "Vercel",
        tagClasses: "bg-rose-100 text-rose-700 border-rose-200",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
        ),
    },
    {
        type: "vercel_bot_protection",
        name: "Vercel Bot Protection",
        description: "Automatically enables Vercel Firewall/Bot Protection when direct traffic spikes.",
        tag: "Vercel",
        tagClasses: "bg-amber-100 text-amber-700 border-amber-200",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
                <path d="M12 2v4M12 18v4M4 12H2M22 12h-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </svg>
        ),
    },
];

export function VercelRuleSelector({ onClose, onSelect }: {
    onClose: () => void;
    onSelect: (type: string) => void;
}) {
    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-indigo-100"
            title="Select Vercel Rule Type"
            subtitle="Choose the type of mitigation rule you want to setup for this project."
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9Z" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            }
        >
            <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {VERCEL_RULES.map((rule) => (
                    <button
                        key={rule.type}
                        onClick={() => onSelect(rule.type)}
                        className="w-full text-left relative flex flex-col sm:flex-row gap-4 p-4 lg:p-5 rounded-md border bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer group transition-all"
                    >
                        <div className="w-12 h-12 shrink-0 rounded-md flex items-center justify-center bg-slate-50 border border-slate-100 group-hover:scale-105 transition-transform">
                            {rule.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <h3 className="font-bold text-base truncate text-slate-900 group-hover:text-indigo-600">
                                    {rule.name}
                                </h3>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${rule.tagClasses}`}>
                                    {rule.tag}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed font-medium">{rule.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </ModalShell>
    );
}
