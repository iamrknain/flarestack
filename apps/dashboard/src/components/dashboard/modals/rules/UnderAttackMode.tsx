"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { dashboardAction } from "~/app/dashboard/actions";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls } from "../../ui/shared";

interface UnderAttackModeProps {
    zoneId: string;
    onClose: () => void;
    isSubmitting: boolean;
    zones: unknown[];
    accounts: unknown[];
    config: {
        name: string;
        description: string;
        type: string;
        icon: ReactNode;
    };
}

export function UnderAttackMode({ zoneId, onClose, config }: UnderAttackModeProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Auto-Off toggle state
    const [autoOff, setAutoOff] = useState(false);
    
    // Notifications state
    const [sendNotification, setSendNotification] = useState(false);

    // Time window state (in seconds)
    const [windowSeconds, setWindowSeconds] = useState(300);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const formData = new FormData(e.currentTarget);
            const res = await dashboardAction(formData);
            if (res?.success) {
                router.refresh();
                onClose();
            } else {
                setError(res?.error || "Failed to add rule");
            }
        } catch (err) {
            console.error("Add rule error:", err);
            setError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-rose-100"
            title={`Add Rule: ${config.name}`}
            subtitle={config.description}
            icon={config.icon}
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                <input type="hidden" name="intent" value="add_rule" />
                <input type="hidden" name="ruleType" value={config.type} />
                <input type="hidden" name="zoneConfigId" value={zoneId} />
                <input type="hidden" name="autoOff" value={autoOff ? "true" : "false"} />
                <input type="hidden" name="sendNotification" value={sendNotification ? "true" : "false"} />

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
                        <input type="text" name="name" placeholder='e.g. "Auto Under Attack Mode"' required className={inputCls} />
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">Internal name for this rule in FlareStack.</p>
                    </div>
                </div>

                {/* Trigger Conditions Section */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Trigger Thresholds (ON)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Trigger Limit (requests)</label>
                            <input type="number" name="rateLimitThreshold" defaultValue={10000} min={1} required className={inputCls} />
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
                                    <input type="number" name="offThreshold" defaultValue={2000} min={1} required className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Recovery Security Level</label>
                                    <select name="recoveryLevel" defaultValue="medium" required className={inputCls}>
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

                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Add Rule" />
            </form>
        </ModalShell>
    );
}
