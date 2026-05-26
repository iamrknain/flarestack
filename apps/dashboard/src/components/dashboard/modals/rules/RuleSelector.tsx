import { ModalShell } from "../../ui/shared";
import { RULE_REGISTRY, type RuleType } from "~/lib/rules/registry";

export function RuleSelector({ onClose, onSelect }: {
    onClose: () => void;
    onSelect: (type: RuleType) => void;
}) {
    const availableRules = Object.values(RULE_REGISTRY);

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
                {availableRules.map((rule) => {
                    const ContentWrapper = rule.enabled ? 'button' : 'div';
                    return (
                        <ContentWrapper
                            key={rule.type}
                            onClick={() => rule.enabled ? onSelect(rule.type as RuleType) : undefined}
                            className={`w-full text-left relative flex flex-col sm:flex-row gap-4 p-4 lg:p-5 rounded-md border transition-all ${rule.enabled
                                ? "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer group"
                                : "bg-slate-50 border-slate-100 opacity-70 cursor-not-allowed"
                                }`}
                        >
                            <div className={`w-12 h-12 shrink-0 rounded-md flex items-center justify-center transition-transform ${rule.enabled ? 'bg-slate-50 border border-slate-100 group-hover:scale-105' : 'bg-slate-100/50'}`}>
                                {rule.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <h3 className={`font-bold text-base truncate ${rule.enabled ? 'text-slate-900 group-hover:text-indigo-600' : 'text-slate-700'}`}>
                                        {rule.name}
                                    </h3>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${rule.tagClasses}`}>
                                        {rule.tag}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                                    {rule.description}
                                </p>
                            </div>
                        </ContentWrapper>
                    );
                })}
            </div>
        </ModalShell>
    );
}
