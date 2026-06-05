"use client";

import { useState, useEffect } from "react";
import { validateTokenPermissionsAction } from "~/server/cloudflare";

interface CheckItem {
    name: string;
    passed: boolean;
    error?: string;
    requiredPermission: string;
}

interface TokenPermissionsValidatorProps {
    zoneId: string;
    ruleType: "add_ip_to_list" | "under_attack_mode";
    cfApiTokenOverride?: string;
    onValidationComplete: (isValid: boolean) => void;
}

export function TokenPermissionsValidator({
    zoneId,
    ruleType,
    cfApiTokenOverride,
    onValidationComplete,
}: TokenPermissionsValidatorProps) {
    const [loading, setLoading] = useState(true);
    const [checks, setChecks] = useState<CheckItem[]>([]);
    const [allPassed, setAllPassed] = useState(false);
    const [bypass, setBypass] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const performValidation = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await validateTokenPermissionsAction(zoneId, ruleType, cfApiTokenOverride);
            if (res.error) {
                setError(res.error);
                onValidationComplete(false);
            } else if (res.success && res.checks) {
                setChecks(res.checks);
                setAllPassed(res.allPassed);
                onValidationComplete(res.allPassed || bypass);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to validate Cloudflare token permissions.";
            console.error("Token permissions validation error:", err);
            setError(message);
            onValidationComplete(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        performValidation();
    }, [zoneId, ruleType, cfApiTokenOverride]);

    // Handle bypass toggle
    const handleBypassChange = (checked: boolean) => {
        setBypass(checked);
        onValidationComplete(allPassed || checked);
    };

    if (loading) {
        return (
            <div className="bg-slate-50 border border-slate-100 rounded-md p-4 flex flex-col items-center justify-center gap-3 py-6">
                <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="text-center">
                    <p className="text-xs font-bold text-slate-800">Validating API Token Permissions</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Verifying required scopes on Cloudflare...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-100 rounded-md p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-rose-800">Validation System Error</p>
                        <p className="text-[11px] text-rose-600 mt-0.5 leading-relaxed">{error}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={performValidation}
                    className="text-[10px] font-black text-rose-700 hover:text-rose-900 uppercase tracking-wider underline"
                >
                    Retry Check
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className={`border rounded-md p-4 transition-all ${allPassed ? "bg-emerald-50/40 border-emerald-100" : "bg-amber-50/50 border-amber-200"}`}>
                <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${allPassed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {allPassed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-bold ${allPassed ? "text-emerald-900" : "text-amber-900"}`}>
                            {allPassed ? "API Token Verified" : "Insufficient Token Permissions"}
                        </h4>
                        <p className={`text-[11px] mt-0.5 leading-relaxed font-medium ${allPassed ? "text-emerald-700" : "text-amber-700"}`}>
                            {allPassed 
                                ? "This API token has all necessary permissions to monitor and apply this rule."
                                : "The connected Cloudflare token is missing some permissions required for this rule."}
                        </p>
                    </div>
                </div>

                {/* Permissions checklist */}
                <div className="mt-4 space-y-3 pt-3 border-t border-dashed border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Permission Check Results</p>
                    {checks.map((check, idx) => (
                        <div key={idx} className="bg-white/80 border border-slate-100 rounded p-2.5 space-y-1.5 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800">{check.name}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    check.passed 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                        : "bg-rose-50 text-rose-700 border border-rose-100"
                                }`}>
                                    {check.passed ? "Passed" : "Failed"}
                                </span>
                            </div>
                            
                            {!check.passed && (
                                <>
                                    <p className="text-[10px] text-rose-600 font-medium leading-relaxed bg-rose-50/50 p-1.5 rounded border border-rose-100/50">
                                        <span className="font-bold">Error:</span> {check.error}
                                    </p>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                        <span className="font-bold text-slate-700">Required:</span>{" "}
                                        <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[9px]">{check.requiredPermission}</code>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {!allPassed && (
                    <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-3">
                        <div className="bg-blue-50 border border-blue-100 rounded p-3 text-[11px] text-blue-800 leading-relaxed font-medium">
                            <p className="font-bold mb-1">How to fix this:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Go to your Cloudflare Dashboard &rarr; My Profile &rarr; API Tokens</li>
                                <li>Edit the token used for this account</li>
                                <li>Ensure you add the missing permissions listed above</li>
                                <li>Save changes and try verifying again</li>
                            </ol>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <input
                                id="bypass-verification"
                                type="checkbox"
                                checked={bypass}
                                onChange={(e) => handleBypassChange(e.target.checked)}
                                className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="bypass-verification" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                                I want to bypass this check and create the rule anyway.
                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5 leading-normal">
                                    The rule may fail to run if the required API actions are blocked.
                                </span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
