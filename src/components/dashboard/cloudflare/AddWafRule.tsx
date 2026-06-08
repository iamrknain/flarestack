"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createWafRuleAction, editWafRuleAction, getWafRulesAction } from "~/server/cloudflare";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls, monoCls } from "../ui/shared";
import { TokenPermissionsValidator } from "./TokenPermissionsValidator";
import type { CfRule } from "~/lib/cloudflare";

interface AddWafRuleProps {
    zoneId: string;
    onClose: () => void;
    isSubmitting: boolean;
    zones: any[];
    accounts: any[];
    rule?: any;
    rules?: any[];
}

export function AddWafRule({ zoneId, onClose, zones = [], accounts = [], rule, rules = [] }: AddWafRuleProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [cfApiTokenOverride, setCfApiTokenOverride] = useState(rule?.cfApiTokenOverride || "");
    const [debouncedToken, setDebouncedToken] = useState(rule?.cfApiTokenOverride || "");
    const [showTokenOverride, setShowTokenOverride] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // WAF rules list state
    const [wafRulesList, setWafRulesList] = useState<CfRule[]>([]);
    const [rulesetId, setRulesetId] = useState(rule?.cfRulesetId || "");
    const [selectedRuleId, setSelectedRuleId] = useState(rule?.cfRuleId || "");
    const [selectedRuleName, setSelectedRuleName] = useState(rule?.cfRuleName || "");
    const [isLoadingWaf, setIsLoadingWaf] = useState(false);
    const [wafLoadError, setWafLoadError] = useState<string | null>(null);
    const [retryTrigger, setRetryTrigger] = useState(0);

    // Auto-Off toggle state
    const [autoOff, setAutoOff] = useState(rule?.autoOff ?? false);

    // Notifications state
    const [sendNotification, setSendNotification] = useState(rule?.sendNotification ?? false);

    // Time window state (in seconds)
    const [windowSeconds, setWindowSeconds] = useState(rule?.windowSeconds ?? 300);

    // Controlled inputs for template loading
    const [name, setName] = useState(rule?.name || "");
    const [rateLimitThreshold, setRateLimitThreshold] = useState(rule?.rateLimitThreshold ?? 10000);
    const [offThreshold, setOffThreshold] = useState(rule?.offThreshold ?? 2000);
    const [notifyEmails, setNotifyEmails] = useState(rule?.notifyEmails || "");

    const activeZone = zones.find((z) => z.id === zoneId);

    // Debounce token override
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedToken(cfApiTokenOverride);
        }, 500);
        return () => clearTimeout(timer);
    }, [cfApiTokenOverride]);

    useEffect(() => {
        const fetchWafRules = async () => {
            const accountRef = activeZone?.cfAccountRef;
            const cfZoneId = activeZone?.cfZoneId;
            if (!accountRef || !cfZoneId) return;
            setIsLoadingWaf(true);
            setWafLoadError(null);
            try {
                const res = await getWafRulesAction(accountRef, cfZoneId, debouncedToken);
                if ("error" in res) {
                    setWafLoadError(res.error);
                } else if (res.rules) {
                    setWafRulesList(res.rules);
                    if (res.ruleset) {
                        setRulesetId(res.ruleset.id);
                    }
                    // If not editing, default to the first WAF rule
                    if (!rule && res.rules.length > 0) {
                        setSelectedRuleId(res.rules[0].id);
                        setSelectedRuleName(res.rules[0].description || "Untitled WAF Rule");
                    }
                }
            } catch (err: any) {
                setWafLoadError(err.message || "Failed to fetch WAF rules from Cloudflare.");
            } finally {
                setIsLoadingWaf(false);
            }
        };

        fetchWafRules();
    }, [zoneId, activeZone?.cfAccountRef, activeZone?.cfZoneId, debouncedToken, retryTrigger]);

    useEffect(() => {
        if (!rule && selectedRuleName && !name.startsWith("Auto:")) {
            setName(`Auto: ${selectedRuleName}`);
        }
    }, [selectedRuleName, rule]);

    const handleRuleSelect = (ruleId: string) => {
        setSelectedRuleId(ruleId);
        const match = wafRulesList.find((r) => r.id === ruleId);
        if (match) {
            setSelectedRuleName(match.description || "Untitled WAF Rule");
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedRuleId || !rulesetId) {
            setError("Please select a target WAF Custom Rule from Cloudflare.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const ruleData = {
                name,
                zoneConfigId: zoneId,
                cfRulesetId: rulesetId,
                cfRuleId: selectedRuleId,
                cfRuleName: selectedRuleName,
                rateLimitThreshold,
                windowSeconds,
                autoOff,
                offThreshold: autoOff ? offThreshold : null,
                sendNotification,
                notifyEmails: sendNotification ? notifyEmails : null,
                cfApiTokenOverride: cfApiTokenOverride.trim() || null,
            };

            const res = rule
                ? await editWafRuleAction(rule.id, ruleData)
                : await createWafRuleAction(ruleData);

            if (res?.success) {
                router.refresh();
                onClose();
            } else {
                setError(res?.error || "Failed to save WAF automation rule");
            }
        } catch (err) {
            console.error("Save rule error:", err);
            setError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const wafRulesTemplates = (rules || []).filter(r => r.type === "waf_rule");

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-indigo-100"
            title={rule ? "Edit Rule: WAF Rule Mitigation" : "Add Rule: WAF Rule Mitigation"}
            subtitle="Automatically enable or disable an existing Cloudflare Custom WAF Rule based on traffic spike thresholds."
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
                            <p className="text-xs font-bold text-blue-800">How WAF Automation Rules Work</p>
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
                                This rule monitors traffic request rates for a specific zone config. When request limits are breached, it automatically enables a specific, preconfigured Cloudflare Custom WAF Rule.
                            </p>
                            <div className="space-y-1.5 pl-1.5 border-l-2 border-blue-200">
                                <div>
                                    <span className="font-bold">1. Select Target:</span> Choose from the list of custom WAF rules currently configured on your Cloudflare dashboard for this zone.
                                </div>
                                <div>
                                    <span className="font-bold">2. Trigger Limit (ON):</span> If requests exceed this limit within the window, the target WAF rule is enabled on Cloudflare.
                                </div>
                                <div>
                                    <span className="font-bold">3. Auto-Off (OFF):</span> Reverts the rule to disabled on Cloudflare when request rates drop back down below your recovery limit.
                                </div>
                                <div>
                                    <span className="font-bold">4. Token Scopes:</span> Requires a connected API Token with <span className="font-semibold text-slate-800">Zone ➔ WAF ➔ Edit</span> permissions.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {wafRulesTemplates.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-md p-4 transition-all hover:shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-600">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                            <p className="text-xs font-bold text-indigo-800">Copy Config from Template</p>
                        </div>
                        <select
                            onChange={(e) => {
                                const selectedRule = wafRulesTemplates.find(r => r.id === e.target.value);
                                if (selectedRule) {
                                    setName(selectedRule.name);
                                    setRateLimitThreshold(selectedRule.rateLimitThreshold);
                                    setWindowSeconds(selectedRule.windowSeconds);
                                    setAutoOff(selectedRule.autoOff);
                                    if (selectedRule.offThreshold !== null && selectedRule.offThreshold !== undefined) {
                                        setOffThreshold(selectedRule.offThreshold);
                                    }
                                    setSendNotification(selectedRule.sendNotification);
                                    if (selectedRule.notifyEmails) {
                                        setNotifyEmails(selectedRule.notifyEmails);
                                    }
                                    if (selectedRule.cfApiTokenOverride) {
                                        setCfApiTokenOverride(selectedRule.cfApiTokenOverride);
                                    }
                                    // Smart match WAF custom rule by description/name in target zone config
                                    const match = wafRulesList.find(r => r.description === selectedRule.cfRuleName || r.id === selectedRule.cfRuleId);
                                    if (match) {
                                        setSelectedRuleId(match.id);
                                        setSelectedRuleName(match.description || "Untitled WAF Rule");
                                    } else {
                                        setSelectedRuleId(selectedRule.cfRuleId);
                                        setSelectedRuleName(selectedRule.cfRuleName);
                                    }
                                    setRulesetId(selectedRule.cfRulesetId);
                                }
                                e.target.value = ""; // Reset select
                            }}
                            className={`${inputCls} text-xs border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500`}
                            defaultValue=""
                        >
                            <option value="" disabled>Select an existing rule to use as a template...</option>
                            {wafRulesTemplates.map((r: any) => {
                                const zone = zones.find(z => z.id === r.zoneConfigId);
                                return (
                                    <option key={r.id} value={r.id}>
                                        {zone ? `${zone.name} (${zone.domain || "no domain"})` : "Unknown Zone"} ➔ {r.name}
                                    </option>
                                );
                            })}
                        </select>
                        <p className="mt-1.5 text-[10px] text-indigo-700 font-medium">
                            Quickly copy the request threshold, time window, rule name, auto-off thresholds, and notification settings from another domain's WAF rule automation.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-700 font-bold">
                        {error}
                    </div>
                )}

                {/* Target WAF Rule Selection */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Target Cloudflare WAF Rule</p>
                    {isLoadingWaf ? (
                        <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
                            <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Loading WAF rules from Cloudflare...</span>
                        </div>
                    ) : wafLoadError ? (
                        <div className="space-y-3">
                            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded text-[11px] text-rose-700 font-medium">
                                <span className="font-bold">Error loading rules:</span> {wafLoadError}
                                <p className="mt-1 text-[10px] text-slate-500 font-normal">Ensure your API Token has WAF Read permissions and matches this zone.</p>
                            </div>
                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => setRetryTrigger(prev => prev + 1)}
                                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded font-bold transition-all shadow-sm active:scale-95 text-[10px]"
                                >
                                    Retry Loading Rules
                                </button>
                            </div>
                        </div>
                    ) : wafRulesList.length === 0 ? (
                        <div className="p-2.5 bg-amber-50 border border-amber-100 rounded text-[11px] text-amber-800 font-medium">
                            No custom WAF rules configured on Cloudflare for this zone. Create a custom rule in your Cloudflare dashboard first.
                        </div>
                    ) : (
                        <div>
                            <label className={labelCls}>Select WAF Rule <span className="text-rose-500">*</span></label>
                            <select
                                value={selectedRuleId}
                                onChange={(e) => handleRuleSelect(e.target.value)}
                                required
                                className={inputCls}
                                disabled={!!rule} // Lock target selection during edit for safety
                            >
                                {wafRulesList.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.description || "Untitled Custom WAF Rule"} ({r.action})
                                    </option>
                                ))}
                                {selectedRuleId && !wafRulesList.some(r => r.id === selectedRuleId) && (
                                    <option value={selectedRuleId}>
                                        {selectedRuleName || "Selected WAF Rule"} ({selectedRuleId.slice(0, 8)}…)
                                    </option>
                                )}
                            </select>
                            <p className="mt-1 text-[10px] text-slate-500 font-medium">Select the WAF custom rule to automate. Only custom zone rules are supported.</p>
                        </div>
                    )}
                </div>

                {/* Identity Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Identity</p>
                    <div>
                        <label className={labelCls}>Automation Rule Name <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            name="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='e.g. "Auto WAF Mitigation Rule"'
                            required
                            className={inputCls}
                        />
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">Internal display name for this automated task.</p>
                    </div>
                </div>

                {/* Trigger Conditions Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Trigger Thresholds (ON)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Trigger Limit (requests)</label>
                            <input
                                type="number"
                                name="rateLimitThreshold"
                                value={rateLimitThreshold}
                                onChange={(e) => setRateLimitThreshold(parseInt(e.target.value) || 0)}
                                min={1}
                                required
                                className={inputCls}
                            />
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
                        If request counts exceed this threshold during the {windowSeconds}s window, FlareStack will automatically enable this WAF rule on Cloudflare.
                    </p>
                </div>

                {/* Auto Off (Recovery) Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={sectionLabelCls} style={{ marginBottom: 0 }}>Auto-Off Recovery (Optional)</p>
                            <p className="text-[10px] text-slate-500 font-medium">Disable the WAF rule once request volume drops back down.</p>
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
                            <div>
                                <label className={labelCls}>Recovery Limit (requests)</label>
                                <input
                                    type="number"
                                    name="offThreshold"
                                    value={offThreshold}
                                    onChange={(e) => setOffThreshold(parseInt(e.target.value) || 0)}
                                    min={1}
                                    required
                                    className={inputCls}
                                />
                            </div>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                The WAF rule will automatically revert to disabled when requests fall below this limit within the {windowSeconds}s window.
                            </p>
                        </div>
                    )}
                </div>

                {/* Notifications Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={sectionLabelCls} style={{ marginBottom: 0 }}>Email Notifications</p>
                            <p className="text-[10px] text-slate-500 font-medium">Send an email alert when the WAF rule is enabled/disabled.</p>
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
                                    value={notifyEmails}
                                    onChange={(e) => setNotifyEmails(e.target.value)}
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
                        Custom API token to override the default account token. Ensure it has Zone WAF Edit scope.
                    </p>
                </div>

                {/* Token Permissions Check */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Token Permissions Check</p>
                    <TokenPermissionsValidator
                        zoneId={zoneId}
                        ruleType="waf_rule"
                        cfApiTokenOverride={debouncedToken}
                        onValidationComplete={setIsTokenValid}
                    />
                </div>

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={rule ? "Save Changes" : "Add Rule"} disabled={!isTokenValid} />
            </form>
        </ModalShell>
    );
}
