"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createVercelBotProtectionRule, editVercelBotProtectionRule } from "~/server/vercel";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls } from "../ui/shared";

interface VercelBotProtectionProps {
    projectId: string;
    onClose: () => void;
    rule?: any;
    zoneConfigs?: any[];
    rules?: any[];
    projects?: any[];
}

export function VercelBotProtection({ projectId, onClose, rule, zoneConfigs = [], rules = [], projects = [] }: VercelBotProtectionProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    
    // Controlled states
    const [name, setName] = useState(rule?.name || "");
    const [trafficSource, setTrafficSource] = useState(rule?.trafficSource || 'vercel_drain');
    const [cfZoneConfigRef, setCfZoneConfigRef] = useState(rule?.cfZoneConfigRef || "");
    const [rateLimitThreshold, setRateLimitThreshold] = useState(rule?.rateLimitThreshold ?? 10000);
    const [action, setAction] = useState(rule?.action || "challenge");
    const [autoOff, setAutoOff] = useState(rule?.autoOff ?? false);
    const [offThreshold, setOffThreshold] = useState(rule?.offThreshold ?? 2000);
    const [windowSeconds, setWindowSeconds] = useState(rule?.windowSeconds ?? 300);
    const [sendNotification, setSendNotification] = useState(rule?.sendNotification ?? false);
    const [notifyEmails, setNotifyEmails] = useState(rule?.notifyEmails || "");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const res = rule
                ? await editVercelBotProtectionRule(rule.id, {
                      name,
                      trafficSource,
                      cfZoneConfigRef: trafficSource === "cloudflare" ? cfZoneConfigRef : null,
                      rateLimitThreshold,
                      autoOff,
                      offThreshold: autoOff ? offThreshold : null,
                      windowSeconds,
                      action,
                      sendNotification,
                      notifyEmails: sendNotification ? notifyEmails : null,
                  })
                : await createVercelBotProtectionRule({
                      name,
                      vercelProjectRef: projectId,
                      trafficSource,
                      cfZoneConfigRef: trafficSource === "cloudflare" ? cfZoneConfigRef : null,
                      rateLimitThreshold,
                      autoOff,
                      offThreshold: autoOff ? offThreshold : null,
                      windowSeconds,
                      action,
                      sendNotification,
                      notifyEmails: sendNotification ? notifyEmails : null,
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

    const vercelBotProtectionTemplates = (rules || []).filter(r => r.type === "vercel_bot_protection");

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-amber-100"
            title={rule ? "Edit Vercel Rule: Bot Protection" : "Add Vercel Rule: Bot Protection"}
            subtitle="Automatically enable Vercel Firewall/Bot Protection when direct traffic spikes and disable it when traffic normalizes."
            icon={(
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                    <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
                    <path d="M12 2v4M12 18v4M4 12H2M22 12h-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
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
                            <p className="text-xs font-bold text-blue-800">How Vercel Bot Protection Rules Work</p>
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
                                This rule scans your Vercel project's traffic metrics. If requests exceed the set threshold, it triggers Vercel Firewall mitigations to protect your application.
                            </p>
                            <div className="space-y-1.5 pl-1.5 border-l-2 border-blue-200">
                                <div>
                                    <span className="font-bold">1. Trigger:</span> If traffic from automated agents or overall requests exceed the <span className="font-semibold text-slate-800">Trigger Limit</span> within <span className="font-semibold text-slate-800">Window</span> seconds.
                                </div>
                                <div>
                                    <span className="font-bold">2. Mitigation Action:</span> The rule switches your Vercel Firewall's bot protection level to block or challenge suspect traffic.
                                </div>
                                <div>
                                    <span className="font-bold">3. Auto-Off:</span> When traffic drops below the recovery threshold, the firewall rule automatically reverts to its standard posture.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {vercelBotProtectionTemplates.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 border border-amber-100 rounded-md p-4 transition-all hover:shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-600">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                            <p className="text-xs font-bold text-amber-800">Copy Config from Template</p>
                        </div>
                        <select
                            onChange={(e) => {
                                const selectedRule = vercelBotProtectionTemplates.find(r => r.id === e.target.value);
                                if (selectedRule) {
                                    setName(selectedRule.name);
                                    setTrafficSource(selectedRule.trafficSource);
                                    setRateLimitThreshold(selectedRule.rateLimitThreshold);
                                    setAction(selectedRule.action || "challenge");
                                    setWindowSeconds(selectedRule.windowSeconds);
                                    setAutoOff(selectedRule.autoOff);
                                    if (selectedRule.offThreshold !== null && selectedRule.offThreshold !== undefined) {
                                        setOffThreshold(selectedRule.offThreshold);
                                    }
                                    setSendNotification(selectedRule.sendNotification);
                                    if (selectedRule.notifyEmails) {
                                        setNotifyEmails(selectedRule.notifyEmails);
                                    }
                                }
                                e.target.value = ""; // Reset select
                            }}
                            className={`${inputCls} text-xs border-amber-200 focus:border-amber-500 focus:ring-amber-500`}
                            defaultValue=""
                        >
                            <option value="" disabled>Select an existing rule to use as a template...</option>
                            {vercelBotProtectionTemplates.map((r: any) => {
                                const project = projects.find(p => p.id === r.vercelProjectRef);
                                return (
                                    <option key={r.id} value={r.id}>
                                        {project ? `${project.name} (${project.domain || "no domain"})` : "Unknown Project"} ➔ {r.name}
                                    </option>
                                );
                            })}
                        </select>
                        <p className="mt-1.5 text-[10px] text-amber-700 font-medium">
                            Quickly copy the request threshold, time window, rule name, traffic source, auto-off thresholds, action settings, and notification settings from another project's Bot Protection rule.
                        </p>
                    </div>
                )}

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
                        <input
                            type="text"
                            name="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='e.g. "Vercel Bot Protection"'
                            required
                            className={inputCls}
                        />
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">Internal name for this rule in FlareStack.</p>
                    </div>
                </div>

                {/* Traffic Source Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm space-y-4">
                    <p className={sectionLabelCls}>Metric / Traffic Source</p>
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="trafficSource"
                                    value="vercel_drain"
                                    checked={trafficSource === "vercel_drain"}
                                    onChange={() => setTrafficSource("vercel_drain")}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                Vercel Log Drain (Direct)
                            </label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="trafficSource"
                                    value="cloudflare"
                                    checked={trafficSource === "cloudflare"}
                                    onChange={() => setTrafficSource("cloudflare")}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                Cloudflare Analytics (Vercel behind CF)
                            </label>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                            {trafficSource === "vercel_drain"
                                ? "Monitors traffic statistics sent directly by Vercel Log Drains (requires Vercel Pro/Enterprise)."
                                : "Monitors traffic to your Vercel site via a proxying Cloudflare zone (works on free Cloudflare plan)."}
                        </p>

                        {trafficSource === "cloudflare" && (
                            <div className="mt-3 space-y-2 animate-fadeIn">
                                <label className={labelCls}>Select Cloudflare Zone <span className="text-rose-500">*</span></label>
                                {zoneConfigs && zoneConfigs.length > 0 ? (
                                    <select
                                        name="cfZoneConfigRef"
                                        value={cfZoneConfigRef}
                                        onChange={(e) => setCfZoneConfigRef(e.target.value)}
                                        required
                                        className={inputCls}
                                    >
                                        <option value="" disabled>-- Select a Zone --</option>
                                        {zoneConfigs.map((z: any) => (
                                            <option key={z.id} value={z.id}>
                                                {z.name} ({z.domain || "no domain"})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                                        No Cloudflare Zones found. Please connect a Cloudflare account first to use Cloudflare analytics.
                                    </div>
                                )}
                            </div>
                        )}
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
                        If the total direct request count to the Vercel project exceeds this trigger limit within the {windowSeconds || 300}s window, Vercel Bot Protection WAF rules will be activated.
                    </p>
                </div>

                {/* Action Settings Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Mitigation Action</p>
                    <div>
                        <label className={labelCls}>WAF Response Action</label>
                        <select
                            name="action"
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            required
                            className={inputCls}
                        >
                            <option value="challenge">Interactive Challenge (CAPTCHA)</option>
                            <option value="deny">Deny (Block Access)</option>
                            <option value="log">Log Only (Monitor Traffic)</option>
                        </select>
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">The firewall action Vercel WAF will execute on suspected automated traffic.</p>
                    </div>
                </div>

                {/* Auto Off (Recovery) Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={sectionLabelCls} style={{ marginBottom: 0 }}>Auto-Off Recovery (Optional)</p>
                            <p className="text-[10px] text-slate-500 font-medium">Automatically disable Bot Protection when traffic subsides.</p>
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
                                Bot Protection will automatically turn off when total direct project requests drop below this limit within the same {windowSeconds || 300}s window.
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

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={rule ? "Save Changes" : "Add Rule"} />
            </form>
        </ModalShell>
    );
}
