import { RULES_MANIFEST, type RuleType } from "@flarestack/rules";
import type { ReactNode } from "react";
import { AddIpToList } from "~/components/dashboard/modals/rules/AddIpToList";

export { type RuleType };

export interface RuleUIDefinition {
    icon: ReactNode;
    enabled: boolean;
    tag: string;
    tagClasses: string;
    renderDetails?: (rule: any, config: any) => ReactNode;
    addComponent?: React.ComponentType<{
        zoneId: string;
        onClose: () => void;
        isSubmitting: boolean;
        zones: any[];
        accounts: any[];
        config: any;
    }>;
    prepareValues?: (formData: FormData) => any;
}

// Decorations for the Dashboard
const UI_DECORATIONS: Record<RuleType, RuleUIDefinition> = {
    'add_ip_to_list': {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
        enabled: true,
        tag: "Available",
        tagClasses: "bg-emerald-100 text-emerald-700 border-emerald-200",
        addComponent: AddIpToList,
        renderDetails: (rule, config) => (
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                <span className="text-sm font-black text-slate-900 truncate shrink-0 max-w-[180px]" title={rule.name}>
                    {rule.name}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
                    {config.name}
                </span>
                <div className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0 hidden sm:block" />
                <span className="text-[10px] font-bold text-indigo-600 truncate shrink-0 max-w-[150px]" title={rule.cfListName || rule.cfListId}>
                    {rule.cfListName || "Global List"}
                </span>
                <div className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0 hidden sm:block" />
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 shrink-0">
                    <span className="text-[11px] text-amber-700 font-black tracking-tight">{rule.rateLimitThreshold?.toLocaleString()}</span>
                    <span className="text-[10px] text-amber-600/70 font-bold uppercase tracking-tighter">Hits</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic shrink-0">{rule.windowSeconds}s Window</span>
            </div>
        ),
        prepareValues: (formData: FormData) => ({
            name: formData.get("name") as string,
            zoneConfigId: formData.get("zoneConfigId") as string,
            cfListId: formData.get("cfListId") as string,
            cfListName: formData.get("cfListName") as string,
            rateLimitThreshold: parseInt(formData.get("rateLimitThreshold") as string) || 10000,
            windowSeconds: parseInt(formData.get("windowSeconds") as string) || 300,
        })
    },
    'js_challenge': {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <rect x="3" y="11" width="18" height="10" rx="2" ry="2" /><circle cx="12" cy="15" r="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        enabled: false,
        tag: "Coming Soon",
        tagClasses: "bg-amber-100 text-amber-700 border-amber-200",
    },
    'block_country': {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        ),
        enabled: false,
        tag: "Coming Soon",
        tagClasses: "bg-blue-100 text-blue-700 border-blue-200",
    }
};

export interface RuleDefinition extends RuleUIDefinition {
    type: RuleType;
    name: string;
    description: string;
    table?: any;
}

export const RULE_REGISTRY: Record<string, RuleDefinition> = Object.keys(RULES_MANIFEST).reduce((acc, key) => {
    const type = key as RuleType;
    acc[type] = {
        ...RULES_MANIFEST[type],
        ...UI_DECORATIONS[type]
    };
    return acc;
}, {} as Record<string, RuleDefinition>);
