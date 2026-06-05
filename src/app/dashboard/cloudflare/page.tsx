"use client";

import { useState, useEffect } from "react";
import { ConnectedAccounts } from "~/components/dashboard/ConnectedAccounts";
import { MetricsGrid } from "~/components/dashboard/MetricsGrid";
import { ZonesList } from "~/components/dashboard/cloudflare/ZonesList";
import { DateRangePicker } from "~/components/DateRangePicker";
import { RecentActions } from "~/components/dashboard/RecentActions";
import { AddAccount } from "~/components/dashboard/cloudflare/AddAccount";
import { AddZone } from "~/components/dashboard/cloudflare/AddZone";
import { RuleSelector } from "~/components/dashboard/cloudflare/RuleSelector";
import { AddIpToList } from "~/components/dashboard/cloudflare/AddIpToList";
import { UnderAttackMode } from "~/components/dashboard/cloudflare/UnderAttackMode";
import { getCloudflareDataAction } from "~/server/cloudflare";
import { useDashboardState } from "~/hooks/useDashboardState";

export default function CloudflarePage() {
    const {
        dateRange,
        setDateRange,
        limit,
        setLimit,
        isLoading,
        handleRefresh,
        refreshTrigger,
    } = useDashboardState(10, "cloudflare");

    const [data, setData] = useState<{
        accounts: any[];
        zones: any[];
        rules: any[];
        recentActions: any[];
        totalBlocks: number;
    } | null>(null);

    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
    const [ruleModalZoneId, setRuleModalZoneId] = useState<string | null>(null);
    const [selectedRuleType, setSelectedRuleType] = useState<string | null>(null);
    const [fetching, setFetching] = useState(true);

    // Edit states
    const [editingAccount, setEditingAccount] = useState<any | null>(null);
    const [editingZone, setEditingZone] = useState<any | null>(null);
    const [editingRule, setEditingRule] = useState<any | null>(null);

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
        const res = await getCloudflareDataAction(paramsObj);
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

    const accounts = data?.accounts || [];
    const zones = data?.zones || [];
    const rules = data?.rules || [];
    const recentActions = data?.recentActions || [];
    const totalBlocks = data?.totalBlocks || 0;

    const cfActions = recentActions.filter(a => a.provider === "cloudflare");
    const cfRuleTypes = ["add_ip_to_list", "under_attack_mode", "js_challenge", "block_country"];
    const cfActiveRules = rules.filter(r => cfRuleTypes.includes(r.type) && r.isActive);

    const CF_RULE_ADD_COMPONENTS: Record<string, React.ComponentType<any>> = {
        add_ip_to_list: AddIpToList,
        under_attack_mode: UnderAttackMode,
    };
    const RuleComponent = selectedRuleType ? CF_RULE_ADD_COMPONENTS[selectedRuleType] : null;

    return (
        <div className="flex flex-col gap-4 sm:gap-6 pb-8 px-6 pt-6">
            {accounts.length === 0 && (
                <div className="mb-2 flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="w-9 h-9 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">No Cloudflare account connected</p>
                        <p className="text-xs text-amber-700 mt-0.5">Connect a CF account before adding zones.</p>
                    </div>
                    <button onClick={() => setIsAccountModalOpen(true)} className="flex-shrink-0 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors">
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
                        onClick={() => setIsZoneModalOpen(true)}
                        disabled={accounts.length === 0}
                        className="flex items-center justify-center gap-1.5 bg-slate-950 text-white text-[10px] font-bold px-3 h-[34px] rounded-md hover:bg-black transition-all shadow-sm active:scale-95 disabled:opacity-30 whitespace-nowrap"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Zone
                    </button>
                </div>
            </header>

            <div className="flex flex-col gap-6 w-full">
                <ConnectedAccounts
                    accounts={accounts}
                    onAdd={() => setIsAccountModalOpen(true)}
                    onEdit={(account) => setEditingAccount(account)}
                    type="cloudflare"
                />

                <MetricsGrid
                    count={zones.length}
                    totalBlocks={totalBlocks}
                    activeRulesCount={cfActiveRules.length}
                    rangeLabel={dateRange.type === "all" ? "All Time" : (dateRange.type === "relative" ? `Last ${dateRange.relativeValue}` : "Custom Range")}
                    type="zone"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <ZonesList
                            zones={zones}
                            accounts={accounts}
                            rules={rules}
                            onAddZone={() => setIsZoneModalOpen(true)}
                            onAddRule={(zoneId: string) => setRuleModalZoneId(zoneId)}
                            onEditZone={(zone) => setEditingZone(zone)}
                            onEditRule={(rule) => setEditingRule(rule)}
                        />
                    </div>
                    <div className="relative w-full h-full min-h-[400px]">
                        <div className="absolute inset-0">
                            <RecentActions actions={cfActions} isLive={dateRange.live} zones={zones} title="Recent Cloudflare Actions" />
                        </div>
                    </div>
                </div>
            </div>

            {isAccountModalOpen && (
                <AddAccount
                    onClose={() => setIsAccountModalOpen(false)}
                    onRefresh={loadData}
                />
            )}

            {editingAccount && (
                <AddAccount
                    account={editingAccount}
                    onClose={() => setEditingAccount(null)}
                    onRefresh={loadData}
                />
            )}

            {isZoneModalOpen && (
                <AddZone
                    onClose={() => setIsZoneModalOpen(false)}
                    accounts={accounts}
                    onRefresh={loadData}
                />
            )}

            {editingZone && (
                <AddZone
                    zone={editingZone}
                    onClose={() => setEditingZone(null)}
                    accounts={accounts}
                    onRefresh={loadData}
                />
            )}

            {ruleModalZoneId && !selectedRuleType && (
                <RuleSelector
                    onClose={() => setRuleModalZoneId(null)}
                    onSelect={(type) => setSelectedRuleType(type)}
                />
            )}

            {ruleModalZoneId && selectedRuleType && RuleComponent && (
                <RuleComponent
                    zoneId={ruleModalZoneId}
                    onClose={() => {
                        setSelectedRuleType(null);
                        setRuleModalZoneId(null);
                        loadData();
                    }}
                    zones={zones}
                    accounts={accounts}
                    isSubmitting={false}
                />
            )}

            {editingRule && (
                editingRule.type === "add_ip_to_list" ? (
                    <AddIpToList
                        zoneId={editingRule.zoneConfigId}
                        rule={editingRule}
                        onClose={() => {
                            setEditingRule(null);
                            loadData();
                        }}
                        zones={zones}
                        accounts={accounts}
                        isSubmitting={false}
                    />
                ) : editingRule.type === "under_attack_mode" ? (
                    <UnderAttackMode
                        zoneId={editingRule.zoneConfigId}
                        rule={editingRule}
                        onClose={() => {
                            setEditingRule(null);
                            loadData();
                        }}
                        zones={zones}
                        accounts={accounts}
                        isSubmitting={false}
                    />
                ) : null
            )}
        </div>
    );
}
