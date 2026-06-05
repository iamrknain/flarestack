"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUnderAttackRule, editUnderAttackRule } from "~/server/cloudflare";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls, monoCls } from "../ui/shared";
import { TokenPermissionsValidator } from "./TokenPermissionsValidator";

interface UnderAttackModeProps {
    zoneId: string;
    onClose: () => void;
    isSubmitting: boolean;
    zones: unknown[];
    accounts: unknown[];
    rule?: any;
}

export function UnderAttackMode({ zoneId, onClose, rule }: UnderAttackModeProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [cfApiTokenOverride, setCfApiTokenOverride] = useState(rule?.cfApiTokenOverride || "");
    const [debouncedToken, setDebouncedToken] = useState(rule?.cfApiTokenOverride || "");
    const [showTokenOverride, setShowTokenOverride] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedToken(cfApiTokenOverride);
        }, 500);
        return () => clearTimeout(timer);
    }, [cfApiTokenOverride]);
    
    // Auto-Off toggle state
    const [autoOff, setAutoOff] = useState(rule?.autoOff ?? false);
    
    // Notifications state
    const [sendNotification, setSendNotification] = useState(rule?.sendNotification ?? false);

    // Time window state (in seconds)
    const [windowSeconds, setWindowSeconds] = useState(rule?.windowSeconds ?? 300);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const formData = new FormData(e.currentTarget);
            const name = formData.get("name") as string;
            const rateLimitThreshold = parseInt(formData.get("rateLimitThreshold") as string) || 10000;
            const offThresholdVal = formData.get("offThreshold");
            const offThreshold = autoOff && offThresholdVal ? parseInt(offThresholdVal as string) : null;
            const recoveryLevel = autoOff ? (formData.get("recoveryLevel") as string) : null;
            const notifyEmails = sendNotification ? (formData.get("notifyEmails") as string) : null;

            const res = rule
                ? await editUnderAttackRule(rule.id, {
                    name,
                    rateLimitThreshold,
                    autoOff,
                    offThreshold,
                    recoveryLevel,
                    windowSeconds,
                    sendNotification,
                    notifyEmails,
                    cfApiTokenOverride: cfApiTokenOverride.trim() || null,
                })
                : await createUnderAttackRule({
                    name,
                    zoneConfigId: zoneId,
                    rateLimitThreshold,
                    autoOff,
                    offThreshold,
                    recoveryLevel,
                    windowSeconds,
                    sendNotification,
                    notifyEmails,
                    cfApiTokenOverride: cfApiTokenOverride.trim() || null,
                });

            if (res?.success) {
                router.refresh();
                onClose();
            } else {
                setError(res?.error || "Failed to save rule");
            }
        } catch (err) {
            console.error("Save rule error:", err);
            setError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-rose-100"
            title={rule ? "Edit Rule: Auto Under Attack Mode" : "Add Rule: Auto Under Attack Mode"}
            subtitle="Automatically enable Cloudflare Under Attack Mode when traffic spikes and disable it when traffic normalizes."
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
            )}
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                <div className="rounded-md border border-blue-100 bg-blue-50 overflow-hidden transition-all duration-300">
                    <button
                        type="button"
                        onClick={() => setIsHelpOpen(!isHelpOpen)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-100/40 hover:bg-blue-100/60 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <p className="text-xs font-bold text-blue-800">How "Auto Under Attack" Rules Work</p>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`text-blue-600 transition-transform duration-200 ${isHelpOpen ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {isHelpOpen && (
                        <div className="px-4 pb-4 pt-3 space-y-2.5 border-t border-blue-100/40 text-xs text-blue-700 leading-relaxed">
                            <p>
                                This rule monitors your zone's total traffic request rate. When a sudden traffic spike exceeds the trigger threshold, the system automatically enables Cloudflare's Under Attack Mode.
                            </p>
                            <div className="space-y-1.5 pl-1.5 border-l-2 border-blue-200">
                                <div>
                                    <span className="font-bold">1. Trigger Condition:</span> If requests exceed <span className="font-semibold text-slate-800">Trigger Limit</span> within <span className="font-semibold text-slate-800">Window</span> seconds, Cloudflare Security Level is bumped to "Under Attack Mode" (forcing a JS challenge for all visitors).
                                </div>
                                <div>
                                    <span className="font-bold">2. Auto-Off (Recovery):</span> If enabled, when traffic drops below <span className="font-semibold text-slate-800">Recovery Limit</span>, the security level is automatically reverted to the selected recovery setting (e.g. Medium or Essentially Off).
                                </div>
                                <div>
                                    <span className="font-bold">3. Token Permissions:</span> The token must possess <span className="font-semibold text-slate-800">Zone ➔ Zone Settings ➔ Edit</span> and <span className="font-semibold text-slate-800">Zone ➔ Analytics ➔ Read</span>.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-700 font-bold">
                        {error}
                    </div>
                )}

                {/* Identity Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Identity</p>
                    <div>
                        <label className={labelCls}>Rule Name <span className="text-rose-500">*</span></label>
                        <input type="text" name="name" defaultValue={rule?.name} placeholder='e.g. "Auto Under Attack Mode"' required className={inputCls} />
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">Internal name for this rule in FlareStack.</p>
                    </div>
                </div>

                {/* Trigger Conditions Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Trigger Thresholds (ON)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Trigger Limit (requests)</label>
                            <input type="number" name="rateLimitThreshold" defaultValue={rule?.rateLimitThreshold ?? 10000} min={1} required className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Window (seconds)</label>
                            <input
                                type="number"
                                name="windowSeconds"
                                value={windowSeconds}
                                onChange={(e) => setWindowSeconds(parseInt(e.target.value) || 0)}
                                min={60}
                                required
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <p className="mt-2.5 text-xs text-slate-500 font-medium leading-relaxed">
                        If the total request count to the zone exceeds this trigger limit within the {windowSeconds || 300}s window, Cloudflare &quot;Under Attack&quot; mode will be activated.
                    </p>
                </div>

                {/* Auto Off (Recovery) Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={sectionLabelCls} style={{ marginBottom: 0 }}>Auto-Off Recovery (Optional)</p>
                            <p className="text-[10px] text-slate-500 font-medium">Automatically turn off Under Attack mode when traffic subsides.</p>
                        </div>
                        <label className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors">
                            <input
                                type="checkbox"
                                checked={autoOff}
                                onChange={(e) => setAutoOff(e.target.checked)}
                                className="sr-only"
                            />
                            <span
                                aria-hidden="true"
                                className={`absolute h-5 w-10 rounded-full transition-colors duration-200 ease-in-out ${autoOff ? "bg-emerald-500" : "bg-slate-300"}`}
                            />
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoOff ? "translate-x-2.5" : "-translate-x-2.5"}`}
                            />
                        </label>
                    </div>

                    {autoOff && (
                        <div className="space-y-4 pt-2 border-t border-gray-100/80 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Recovery Limit (requests)</label>
                                    <input type="number" name="offThreshold" defaultValue={rule?.offThreshold ?? 2000} min={1} required className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Recovery Security Level</label>
                                    <select name="recoveryLevel" defaultValue={rule?.recoveryLevel || "medium"} required className={inputCls}>
                                        <option value="essentially_off">Essentially Off (Very Low)</option>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Under Attack Mode will automatically turn off and revert to your chosen recovery level when total zone requests drop below this limit within the same {windowSeconds || 300}s window.
                            </p>
                        </div>
                    )}
                </div>

                {/* Notifications Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={sectionLabelCls} style={{ marginBottom: 0 }}>Email Notifications</p>
                            <p className="text-[10px] text-slate-500 font-medium">Send an email alert when the security mode toggles.</p>
                        </div>
                        <label className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors">
                            <input
                                type="checkbox"
                                checked={sendNotification}
                                onChange={(e) => setSendNotification(e.target.checked)}
                                className="sr-only"
                            />
                            <span
                                aria-hidden="true"
                                className={`absolute h-5 w-10 rounded-full transition-colors duration-200 ease-in-out ${sendNotification ? "bg-emerald-500" : "bg-slate-300"}`}
                            />
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sendNotification ? "translate-x-2.5" : "-translate-x-2.5"}`}
                            />
                        </label>
                    </div>

                    {sendNotification && (
                        <div className="space-y-4 pt-2 border-t border-gray-100/80 animate-fadeIn">
                            <div>
                                <label className={labelCls}>Recipient Emails <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    name="notifyEmails"
                                    defaultValue={rule?.notifyEmails || ""}
                                    placeholder="e.g. admin@example.com, security@example.com"
                                    required
                                    className={inputCls}
                                />
                                <p className="mt-1.5 text-[10px] text-slate-500 font-medium">
                                    Separate multiple emails with commas.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom API Token Override */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className={sectionLabelCls}>Custom API Token Override</p>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Optional</span>
                    </div>
                    <div className="relative mt-1">
                        <input
                            type={showTokenOverride ? "text" : "password"}
                            name="cfApiTokenOverride"
                            value={cfApiTokenOverride}
                            onChange={(e) => setCfApiTokenOverride(e.target.value)}
                            placeholder="Paste custom API token to override default..."
                            className={`${monoCls} pr-10`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowTokenOverride(!showTokenOverride)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showTokenOverride ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                                </svg>
                            )}
                        </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-500 font-medium">
                        Use a restricted API token specifically for this rule. If empty, the default account token will be used.
                    </p>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Token Permissions Check</p>
                    <TokenPermissionsValidator
                        zoneId={zoneId}
                        ruleType="under_attack_mode"
                        cfApiTokenOverride={debouncedToken}
                        onValidationComplete={setIsTokenValid}
                    />
                </div>

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={rule ? "Save Changes" : "Add Rule"} disabled={!isTokenValid} />
            </form>
        </ModalShell>
    );
}
