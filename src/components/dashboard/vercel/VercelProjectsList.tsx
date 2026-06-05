import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleVercelProjectStatus, deleteVercelProject, toggleVercelRuleStatus, deleteVercelRule } from "~/server/vercel";

export function VercelProjectsList({
    projects,
    rules,
    hasAccounts = true,
    onAddAccount,
    onAddProject,
    onAddRule,
    onEditRule,
    onEditProject
}: {
    projects: any[];
    rules: any[];
    hasAccounts?: boolean;
    onAddAccount?: () => void;
    onAddProject: () => void;
    onAddRule: (projectId: string) => void;
    onEditRule?: (projectId: string, rule: any) => void;
    onEditProject?: (project: any) => void;
}) {
    const router = useRouter();
    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
    const [openWebhookHelp, setOpenWebhookHelp] = useState<Record<string, boolean>>({});
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    const toggleWebhookHelp = (projectId: string) => {
        setOpenWebhookHelp(prev => ({ ...prev, [projectId]: !prev[projectId] }));
    };

    const toggleExpanded = (projectId: string) => {
        setExpandedProjects(prev => ({ ...prev, [projectId]: prev[projectId] === false ? true : false }));
    };

    const handleAction = async (e: React.FormEvent, intent: string, params: Record<string, string>) => {
        e.preventDefault();
        const key = `${intent}-${params.id || params.projectId || params.ruleId}`;
        setSubmittingId(key);
        try {
            let res;
            if (intent === "toggle_vercel_project_status") {
                res = await toggleVercelProjectStatus(params.projectId, params.isActive === "true");
            } else if (intent === "delete_vercel_project") {
                res = await deleteVercelProject(params.projectId);
            } else if (intent === "toggle_rule_status") {
                res = await toggleVercelRuleStatus(params.ruleId, params.ruleType, params.isActive === "true");
            } else if (intent === "delete_rule") {
                res = await deleteVercelRule(params.ruleId, params.ruleType);
            }

            if (res?.success) {
                router.refresh();
            } else {
                alert(res?.error || `Failed to perform ${intent}`);
            }
        } catch (err) {
            console.error("Action error:", err);
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                        <polygon points="12 2 2 22 22 22" />
                    </svg>
                    Vercel Projects
                </h2>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{projects.length} Monitored</span>
                    {hasAccounts ? (
                        <button
                            onClick={onAddProject}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Project
                        </button>
                    ) : (
                        <button
                            onClick={onAddAccount}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Connect Account
                        </button>
                    )}
                </div>
            </div>

            <div className="divide-y divide-gray-100">
                {projects.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            {hasAccounts ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                    <polygon points="12 2 2 22 22 22" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            )}
                        </div>
                        <p className="text-black font-medium text-sm">
                            {hasAccounts ? "No Vercel projects registered yet." : "No Vercel accounts connected yet."}
                        </p>
                        {hasAccounts ? (
                            <button onClick={onAddProject} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                                + Register your first Vercel project
                            </button>
                        ) : (
                            <button onClick={onAddAccount} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                                + Connect your first Vercel account
                            </button>
                        )}
                    </div>
                ) : (
                    projects.map((project) => {
                        const projectRules = rules.filter((r) => r.vercelProjectRef === project.id);
                        const isExpanded = expandedProjects[project.id] !== false; // true by default

                        return (
                            <div key={project.id} className="p-6 border-b border-gray-100 last:border-0 bg-gradient-to-br from-white to-gray-50/30">
                                <div className="flex justify-between items-center gap-4">
                                    <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                                        <form
                                            onSubmit={(e: React.FormEvent) => {
                                                const message = project.isActive
                                                    ? "Deactivating this project will also disable all protection rules for it. Continue?"
                                                    : "Activating this project will also enable all protection rules for it. Continue?";
                                                if (confirm(message)) {
                                                    handleAction(e, "toggle_vercel_project_status", {
                                                        projectId: project.id,
                                                        isActive: (!project.isActive).toString()
                                                    });
                                                } else {
                                                    e.preventDefault();
                                                }
                                            }}
                                            className="shrink-0"
                                        >
                                            <button
                                                type="submit"
                                                disabled={submittingId === `toggle_vercel_project_status-${project.id}`}
                                                className={`group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors disabled:opacity-50 ${project.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                            >
                                                <span className="sr-only">Toggle project status</span>
                                                <span
                                                    aria-hidden="true"
                                                    className={`pointer-events-none absolute h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${project.isActive ? 'translate-x-2.5' : '-translate-x-2.5'}`}
                                                />
                                            </button>
                                        </form>

                                        <div className="flex items-baseline gap-2 shrink-0 max-w-[50%]">
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{project.name}</h3>
                                            {project.domain && (
                                                <span className="text-xs text-slate-400 font-mono tracking-tight font-medium shrink-0">
                                                    ({project.domain})
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            <span className="text-[10px] font-black text-slate-500 tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">ID: {project.vercelProjectId.slice(0, 10)}…</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => onAddRule(project.id)}
                                            disabled={!project.isActive}
                                            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Add Rule
                                        </button>

                                        {onEditProject && (
                                            <button
                                                type="button"
                                                onClick={() => onEditProject(project)}
                                                className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                                                title="Edit project"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                </svg>
                                            </button>
                                        )}

                                        <form onSubmit={(e: React.FormEvent) => {
                                            if (confirm(`Delete project "${project.name}" and all its rules?`)) {
                                                handleAction(e, "delete_vercel_project", { projectId: project.id });
                                            } else {
                                                e.preventDefault();
                                            }
                                        }}>
                                            <button type="submit" disabled={submittingId === `delete_vercel_project-${project.id}`} className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                                </svg>
                                            </button>
                                        </form>
                                    </div>
                                </div>

                                {/* Webhook copy widget */}
                                <div className="bg-slate-50 border border-slate-200/60 rounded-md p-3 mt-4 text-xs">
                                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shrink-0">
                                                Direct Ingestion
                                            </span>
                                            <code className="bg-white border border-slate-200 px-2.5 py-1 rounded font-mono text-[11px] text-slate-700 select-all truncate flex-1">
                                                {typeof window !== "undefined" ? `${window.location.origin.replace("dashboard", "worker").replace("3000", "8787")}/api/vercel-logs` : "https://<your-worker-domain>/api/vercel-logs"}
                                            </code>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleWebhookHelp(project.id)}
                                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded shadow-sm transition-colors shrink-0"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                            </svg>
                                            <span>{openWebhookHelp[project.id] ? "Hide Info" : "Setup Instructions"}</span>
                                        </button>
                                    </div>
                                    {openWebhookHelp[project.id] && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/60 text-slate-600 font-medium leading-relaxed animate-fadeIn space-y-3">
                                            <div>
                                                <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Choosing a Traffic Source</h4>
                                                <p className="text-[11px] text-slate-500">
                                                    You can configure security rules to monitor traffic using either <strong>Cloudflare Analytics</strong> or <strong>Vercel Log Drains</strong>:
                                                </p>
                                                <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px] text-slate-500">
                                                    <li><strong>Cloudflare Analytics:</strong> Recommended if your Vercel project is proxied behind Cloudflare. No additional setup is required once your Cloudflare Zone is connected.</li>
                                                    <li><strong>Vercel Log Drain (Direct Ingestion):</strong> Recommended if your project receives direct-to-origin traffic. Configure a Log Drain on Vercel pointing to the ingestion URL above.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-1">How to setup Vercel Log Drain</h4>
                                                <p className="text-[11px] text-slate-500">
                                                    To forward traffic metrics from Vercel to FlareStack:
                                                </p>
                                                <ol className="list-decimal pl-4 mt-1 space-y-1 text-[11px] text-slate-500">
                                                    <li>Go to your <strong>Vercel Dashboard</strong> and select your project.</li>
                                                    <li>Navigate to <strong>Settings</strong> &gt; <strong>Integrations</strong>.</li>
                                                    <li>Find or add an <strong>HTTP Log Drain</strong> integration.</li>
                                                    <li>Set the Destination URL to the <strong>Direct Ingestion URL</strong> above.</li>
                                                    <li>Select <strong>JSON</strong> format and enable <strong>Request Logs</strong>.</li>
                                                </ol>
                                                <p className="text-[10px] text-slate-400 mt-2 italic">
                                                    Alternatively, setup via Vercel CLI: <code className="bg-slate-100 border border-slate-200/80 px-1 py-0.5 rounded font-mono text-[9px]">vercel log-drains add --json &lt;url&gt;</code>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rules under this project */}
                                {projectRules.length > 0 && (
                                    <div className={`mt-6 bg-gradient-to-br from-white to-indigo-50/40 border border-indigo-100/60 rounded-md shadow-sm transition-all overflow-hidden ${isExpanded ? 'p-5' : 'px-5 py-3'}`}>
                                        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4' : ''}`}>
                                            <span className="text-[9px] uppercase font-black text-indigo-600 tracking-[0.2em] opacity-80 shrink-0">Active Rules</span>
                                            <div className="h-[1px] flex-1 mx-4 bg-indigo-100" />
                                            <button
                                                onClick={() => toggleExpanded(project.id)}
                                                className="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-1 rounded-md transition-colors shadow-sm"
                                                title={isExpanded ? "Collapse rules" : "Expand rules"}
                                            >
                                                <span>{projectRules.length} {projectRules.length === 1 ? 'Rule' : 'Rules'}</span>
                                                <svg className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9" />
                                                </svg>
                                            </button>
                                        </div>
                                        {isExpanded && (
                                            <div className="space-y-3">
                                                {projectRules.map((rule) => (
                                                    <div key={rule.id} className={`flex items-center gap-4 px-5 py-3 bg-white border ${rule.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'} shadow-sm rounded-md group/rule hover:border-indigo-400 transition-all`}>
                                                        <form
                                                            onSubmit={(e) => {
                                                                handleAction(e, "toggle_rule_status", {
                                                                    ruleId: rule.id,
                                                                    isActive: (!rule.isActive).toString(),
                                                                    ruleType: rule.type
                                                                });
                                                            }}
                                                            className="flex items-center flex-shrink-0"
                                                        >
                                                            <button
                                                                type="submit"
                                                                disabled={!project.isActive || submittingId === `toggle_rule_status-${rule.id}`}
                                                                className={`group relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors disabled:cursor-not-allowed ${rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'} ${!project.isActive ? 'opacity-50' : ''}`}
                                                            >
                                                                <span className="sr-only">Toggle rule status</span>
                                                                <span
                                                                    aria-hidden="true"
                                                                    className={`pointer-events-none absolute h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${rule.isActive ? 'translate-x-2' : '-translate-x-2'}`}
                                                                />
                                                            </button>
                                                        </form>

                                                        <RuleDetails rule={rule} />

                                                        {onEditRule && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onEditRule(project.id, rule)}
                                                                title="Edit rule"
                                                                className="p-1.5 text-indigo-500 hover:text-indigo-700 transition-all bg-white rounded-md shadow-sm border border-gray-100 shrink-0"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                                </svg>
                                                            </button>
                                                        )}

                                                        <form onSubmit={(e: React.FormEvent) => {
                                                            if (confirm("Delete this rule?")) {
                                                                handleAction(e, "delete_rule", {
                                                                    ruleId: rule.id,
                                                                    ruleType: rule.type
                                                                });
                                                            } else {
                                                                e.preventDefault();
                                                            }
                                                        }}>
                                                            <button type="submit" disabled={submittingId === `delete_rule-${rule.id}`} title="Delete rule" className="p-1.5 text-rose-500 hover:text-rose-700 transition-all bg-white rounded-md shadow-sm border border-gray-100 shrink-0 disabled:opacity-50">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        </form>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function RuleDetails({ rule }: { rule: any }) {
    if (rule.type === "vercel_under_attack_mode") {
        return (
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                <div className="flex flex-col min-w-[120px] max-w-[180px] shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-rose-500/80 leading-none mb-0.5">Under Attack</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${
                    rule.trafficSource === "cloudflare"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                    {rule.trafficSource === "cloudflare" ? "CF Analytics" : "Log Drain"}
                </div>
                <div className="flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    <span className="text-[11px] text-rose-700 font-black">{rule.rateLimitThreshold?.toLocaleString()}</span>
                    <span className="text-[10px] text-rose-600/70 font-bold uppercase">On Trigger</span>
                </div>
                {rule.autoOff ? (
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-black">{rule.offThreshold?.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase">Off Trigger</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Manual Recovery</span>
                )}
                <span className="text-[10px] text-slate-400 font-bold uppercase italic">{rule.windowSeconds}s Window</span>
                {rule.sendNotification && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100" title={rule.notifyEmails || "No emails configured"}>
                        <span className="text-[11px] text-blue-700 font-black">
                            {rule.notifyEmails ? (rule.notifyEmails.length > 20 ? rule.notifyEmails.slice(0, 20) + "..." : rule.notifyEmails) : "Enabled"}
                        </span>
                    </div>
                )}
            </div>
        );
    }
    if (rule.type === "vercel_bot_protection") {
        return (
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                <div className="flex flex-col min-w-[120px] max-w-[180px] shrink-0">
                    <span className="text-[9px] uppercase font-black tracking-wider text-purple-500/80 leading-none mb-0.5">Bot Protection</span>
                    <span className="text-sm font-black text-slate-900 truncate leading-tight" title={rule.name}>{rule.name}</span>
                </div>
                <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${
                    rule.trafficSource === "cloudflare"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                    {rule.trafficSource === "cloudflare" ? "CF Analytics" : "Log Drain"}
                </div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase">Action: {rule.action}</span>
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    <span className="text-[11px] text-amber-700 font-black">{rule.rateLimitThreshold?.toLocaleString()}</span>
                    <span className="text-[10px] text-amber-600/70 font-bold uppercase">On Trigger</span>
                </div>
                {rule.autoOff ? (
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-black">{rule.offThreshold?.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase">Off Trigger</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Manual Recovery</span>
                )}
                <span className="text-[10px] text-slate-400 font-bold uppercase italic">{rule.windowSeconds}s Window</span>
                {rule.sendNotification && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100" title={rule.notifyEmails || "No emails configured"}>
                        <span className="text-[11px] text-blue-700 font-black">
                            {rule.notifyEmails ? (rule.notifyEmails.length > 20 ? rule.notifyEmails.slice(0, 20) + "..." : rule.notifyEmails) : "Enabled"}
                        </span>
                        <span className="text-[10px] text-blue-600/70 font-bold uppercase">Notify</span>
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-black text-slate-900 uppercase">{rule.name || rule.type}</span>
        </div>
    );
}
