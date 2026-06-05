"use client";

import { useState, useEffect } from "react";
import { ConnectedAccounts } from "~/components/dashboard/ConnectedAccounts";
import { MetricsGrid } from "~/components/dashboard/MetricsGrid";
import { VercelProjectsList } from "~/components/dashboard/vercel/VercelProjectsList";
import { DateRangePicker } from "~/components/DateRangePicker";
import { RecentActions } from "~/components/dashboard/RecentActions";
import { AddVercelAccount } from "~/components/dashboard/vercel/AddVercelAccount";
import { AddVercelProject } from "~/components/dashboard/vercel/AddVercelProject";
import { VercelRuleSelector } from "~/components/dashboard/vercel/VercelRuleSelector";
import { VercelUnderAttackMode } from "~/components/dashboard/vercel/VercelUnderAttackMode";
import { VercelBotProtection } from "~/components/dashboard/vercel/VercelBotProtection";
import { getVercelDataAction } from "~/server/vercel";
import { useDashboardState } from "~/hooks/useDashboardState";

export default function VercelPage() {
    const {
        dateRange,
        setDateRange,
        limit,
        setLimit,
        isLoading,
        handleRefresh,
        refreshTrigger,
    } = useDashboardState(10, "vercel");

    const [data, setData] = useState<{
        vercelAccounts: any[];
        vercelProjects: any[];
        rules: any[];
        recentActions: any[];
        totalBlocks: number;
        zoneConfigs?: any[];
    } | null>(null);

    const [isVercelAccountModalOpen, setIsVercelAccountModalOpen] = useState(false);
    const [selectedVercelAccount, setSelectedVercelAccount] = useState<any | null>(null);
    const [isVercelProjectModalOpen, setIsVercelProjectModalOpen] = useState(false);
    const [selectedVercelProject, setSelectedVercelProject] = useState<any | null>(null);
    const [ruleModalProjectId, setRuleModalProjectId] = useState<string | null>(null);
    const [selectedRuleType, setSelectedRuleType] = useState<string | null>(null);
    const [selectedRuleToEdit, setSelectedRuleToEdit] = useState<any | null>(null);
    const [fetching, setFetching] = useState(true);

    const loadData = async () => {
        setFetching(true);
        const paramsObj: any = {
            type: dateRange.type,
            relative: dateRange.relativeValue,
            start: dateRange.start?.toISOString(),
            end: dateRange.end?.toISOString(),
            live: dateRange.live,
            limit: limit,
        };
        const res = await getVercelDataAction(paramsObj);
        if (res.success && res.data) {
            setData(res.data);
        }
        setFetching(false);
    };

    useEffect(() => {
        loadData();
    }, [dateRange, limit, refreshTrigger]);

    if (!data && fetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    const vercelAccounts = data?.vercelAccounts || [];
    const vercelProjects = data?.vercelProjects || [];
    const rules = data?.rules || [];
    const recentActions = data?.recentActions || [];
    const totalBlocks = data?.totalBlocks || 0;
    const zoneConfigs = data?.zoneConfigs || [];

    const vercelActions = recentActions.filter(a => a.provider === "vercel");
    const vercelRuleTypes = ["vercel_under_attack_mode", "vercel_bot_protection"];
    const vercelActiveRules = rules.filter(r => vercelRuleTypes.includes(r.type) && r.isActive);

    const VERCEL_RULE_ADD_COMPONENTS: Record<string, React.ComponentType<any>> = {
        vercel_under_attack_mode: VercelUnderAttackMode,
        vercel_bot_protection: VercelBotProtection,
    };
    const RuleComponent = selectedRuleType ? VERCEL_RULE_ADD_COMPONENTS[selectedRuleType] : null;

    return (
        <div className="flex flex-col gap-4 sm:gap-6 pb-8 px-6 pt-6">
            {vercelAccounts.length === 0 && (
                <div className="mb-2 flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="w-9 h-9 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">No Vercel account connected</p>
                        <p className="text-xs text-amber-700 mt-0.5">Connect a Vercel account before adding projects.</p>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedVercelAccount(null);
                            setIsVercelAccountModalOpen(true);
                        }}
                        className="flex-shrink-0 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                    >
                        Connect Account
                    </button>
                </div>
            )}

            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/60 py-3 flex flex-row flex-wrap gap-2 items-center w-full">
                <div className="shrink-0 flex items-center gap-2">
                    <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        isLoading={isLoading || fetching}
                        liveLabel="Live Active"
                        align="left"
                    />

                    {dateRange.live && (
                        <div className="flex items-center gap-1.5 px-2.5 h-[34px] rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
                        </div>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading || fetching}
                        className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-900 text-[10px] font-bold px-3 h-[34px] border border-slate-200 rounded-md shadow-sm transition-all active:scale-95 whitespace-nowrap"
                    >
                        {isLoading || fetching ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                        )}
                        Fetch
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

                    <button
                        onClick={() => {
                            setSelectedVercelProject(null);
                            setIsVercelProjectModalOpen(true);
                        }}
                        disabled={vercelAccounts.length === 0}
                        className="flex items-center justify-center gap-1.5 bg-slate-950 text-white text-[10px] font-bold px-3 h-[34px] rounded-md hover:bg-black transition-all shadow-sm active:scale-95 disabled:opacity-30 whitespace-nowrap"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Project
                    </button>
                </div>
            </header>

            <div className="flex flex-col gap-6 w-full">
                <ConnectedAccounts
                    accounts={vercelAccounts}
                    onAdd={() => {
                        setSelectedVercelAccount(null);
                        setIsVercelAccountModalOpen(true);
                    }}
                    onEdit={(account) => {
                        setSelectedVercelAccount(account);
                        setIsVercelAccountModalOpen(true);
                    }}
                    type="vercel"
                />

                <MetricsGrid
                    count={vercelProjects.length}
                    totalBlocks={totalBlocks}
                    activeRulesCount={vercelActiveRules.length}
                    rangeLabel={dateRange.type === "all" ? "All Time" : (dateRange.type === "relative" ? `Last ${dateRange.relativeValue}` : "Custom Range")}
                    type="vercel"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <VercelProjectsList
                            projects={vercelProjects}
                            rules={rules}
                            hasAccounts={vercelAccounts.length > 0}
                            onAddAccount={() => {
                                setSelectedVercelAccount(null);
                                setIsVercelAccountModalOpen(true);
                            }}
                            onAddProject={() => {
                                setSelectedVercelProject(null);
                                setIsVercelProjectModalOpen(true);
                            }}
                            onAddRule={(projectId: string) => {
                                setSelectedRuleToEdit(null);
                                setRuleModalProjectId(projectId);
                            }}
                            onEditRule={(projectId: string, rule: any) => {
                                setSelectedRuleToEdit(rule);
                                setRuleModalProjectId(projectId);
                                setSelectedRuleType(rule.type);
                            }}
                            onEditProject={(project: any) => {
                                setSelectedVercelProject(project);
                                setIsVercelProjectModalOpen(true);
                            }}
                        />
                    </div>
                    <div className="relative w-full h-full min-h-[400px]">
                        <div className="absolute inset-0">
                            <RecentActions actions={vercelActions} isLive={dateRange.live} vercelProjects={vercelProjects} title="Recent Vercel Actions" />
                        </div>
                    </div>
                </div>
            </div>

            {isVercelAccountModalOpen && (
                <AddVercelAccount
                    onClose={() => {
                        setIsVercelAccountModalOpen(false);
                        setSelectedVercelAccount(null);
                    }}
                    onRefresh={loadData}
                    account={selectedVercelAccount}
                />
            )}

            {isVercelProjectModalOpen && (
                <AddVercelProject
                    onClose={() => {
                        setIsVercelProjectModalOpen(false);
                        setSelectedVercelProject(null);
                    }}
                    accounts={vercelAccounts}
                    onRefresh={loadData}
                    project={selectedVercelProject}
                />
            )}

            {ruleModalProjectId && !selectedRuleType && (
                <VercelRuleSelector
                    onClose={() => setRuleModalProjectId(null)}
                    onSelect={(type) => setSelectedRuleType(type)}
                />
            )}

            {ruleModalProjectId && selectedRuleType && RuleComponent && (
                <RuleComponent
                    projectId={ruleModalProjectId}
                    rule={selectedRuleToEdit}
                    zoneConfigs={zoneConfigs}
                    onClose={() => {
                        setSelectedRuleType(null);
                        setRuleModalProjectId(null);
                        setSelectedRuleToEdit(null);
                        loadData();
                    }}
                />
            )}
        </div>
    );
}
