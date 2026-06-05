"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AddAccount } from "~/components/dashboard/modals/AddAccount";
import { AddZone } from "~/components/dashboard/modals/AddZone";
import { AddVercelProject } from "~/components/dashboard/modals/AddVercelProject";
import { AddVercelAccount } from "~/components/dashboard/modals/AddVercelAccount";
import { RuleSelector } from "~/components/dashboard/modals/rules/RuleSelector";
import { RULE_REGISTRY, type RuleType } from "~/lib/rules/registry";
import { TopStatsExplorer } from "~/components/dashboard/views/TopStatsExplorer";
import { Cloudflare } from "~/components/dashboard/views/Cloudflare";
import { Vercel } from "~/components/dashboard/views/Vercel";
import { ActionLogs } from "~/components/dashboard/views/ActionLogs";
import { Lists } from "~/components/dashboard/views/Lists";
import { Profile } from "~/components/dashboard/views/Profile";
import type { DateRange } from "~/components/shared/DateRangePicker";

interface DashboardClientPageProps {
  user: any;
  accounts: any[];
  zones: any[];
  vercelAccounts: any[];
  vercelProjects: any[];
  rules: any[];
  recentActions: any[];
  totalBlocks: number;
  currentTab: string;
}

export default function DashboardClientPage({
  user,
  accounts,
  zones,
  vercelAccounts,
  vercelProjects,
  rules,
  recentActions,
  totalBlocks,
  currentTab,
}: DashboardClientPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isVercelProjectModalOpen, setIsVercelProjectModalOpen] = useState(false);
  const [isVercelAccountModalOpen, setIsVercelAccountModalOpen] = useState(false);
  const [ruleModalZoneId, setRuleModalZoneId] = useState<string | null>(null);
  const [ruleModalTargetType, setRuleModalTargetType] = useState<'zone' | 'vercel'>('zone');
  const [selectedRuleType, setSelectedRuleType] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [dateRange, _setDateRange] = useState<DateRange>(() => {
    // 1. Try URL first
    const type = searchParams.get("type") as "relative" | "absolute" | "all" | null;
    if (type) {
      return {
        type,
        relativeValue: searchParams.get("relative") || "30m",
        start: searchParams.get("start") ? new Date(searchParams.get("start")!) : undefined,
        end: searchParams.get("end") ? new Date(searchParams.get("end")!) : undefined,
        live: searchParams.get("live") === "true",
        refreshInterval: parseInt(searchParams.get("refresh") || "10"),
      };
    }

    // 2. Try localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flarestack_daterange");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.start) parsed.start = new Date(parsed.start);
          if (parsed.end) parsed.end = new Date(parsed.end);
          return parsed;
        } catch (e) {
          console.error("Failed to parse saved daterange", e);
        }
      }
    }
    return { type: "relative", relativeValue: "30m", live: false, refreshInterval: 10 };
  });

  const [limit, _setLimit] = useState<number>(() => {
    // 1. URL
    const qLimit = searchParams.get("limit");
    if (qLimit) return parseInt(qLimit);

    // 2. LocalStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flarestack_limit");
      if (saved) return parseInt(saved);
    }

    return currentTab === "logs" ? 100 : 10;
  });

  const [activeZoneId, _setActiveZoneId] = useState<string>(() => {
    // 1. URL
    const qZone = searchParams.get("zoneId");
    if (qZone) return qZone;

    // 2. LocalStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ff_top_stats_zone");
      if (saved) return saved;
    }
    return "";
  });

  const syncToUrl = (range: DateRange, l: number, zoneId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", range.type);
    if (range.type === "relative") {
      params.set("relative", range.relativeValue || "30m");
      params.delete("start");
      params.delete("end");
    } else if (range.type === "absolute") {
      params.set("start", range.start?.toISOString() || "");
      params.set("end", range.end?.toISOString() || "");
      params.delete("relative");
    } else {
      params.delete("relative");
      params.delete("start");
      params.delete("end");
    }
    params.set("live", String(range.live || false));
    params.set("refresh", String(range.refreshInterval || 10));
    params.set("limit", String(l));

    if (zoneId) params.set("zoneId", zoneId);
    else params.delete("zoneId");

    params.delete("actions");

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setDateRange = (newRange: DateRange) => {
    _setDateRange(newRange);
    if (typeof window !== "undefined") {
      localStorage.setItem("flarestack_daterange", JSON.stringify(newRange));
    }
    syncToUrl(newRange, limit, activeZoneId);
  };

  const setLimit = (newLimit: number) => {
    _setLimit(newLimit);
    if (typeof window !== "undefined") {
      localStorage.setItem("flarestack_limit", String(newLimit));
    }
    syncToUrl(dateRange, newLimit, activeZoneId);
  };

  const setActiveZoneId = (zId: string) => {
    _setActiveZoneId(zId);
    if (typeof window !== "undefined") {
      localStorage.setItem("ff_top_stats_zone", zId);
    }
    syncToUrl(dateRange, limit, zId);
  };

  // Guarantee that URL matches local state
  useEffect(() => {
    const urlZone = searchParams.get("zoneId") || "";
    const urlLimit = searchParams.get("limit");

    if (
      !searchParams.has("type") ||
      urlZone !== activeZoneId ||
      urlLimit !== String(limit)
    ) {
      syncToUrl(dateRange, limit, activeZoneId);
    }
  }, [searchParams, currentTab, dateRange, limit, activeZoneId]);

  useEffect(() => {
    const type = searchParams.get("type") as "relative" | "absolute" | "all" | null;
    if (type) {
      _setDateRange({
        type,
        relativeValue: searchParams.get("relative") || "30m",
        start: searchParams.get("start") ? new Date(searchParams.get("start")!) : undefined,
        end: searchParams.get("end") ? new Date(searchParams.get("end")!) : undefined,
        live: searchParams.get("live") === "true",
        refreshInterval: parseInt(searchParams.get("refresh") || "10"),
      });
    }

    const qLimit = searchParams.get("limit");
    if (qLimit) {
      _setLimit(parseInt(qLimit));
    }

    const qZone = searchParams.get("zoneId");
    if (qZone !== null) {
      _setActiveZoneId(qZone);
    }
  }, [searchParams]);

  // Periodic refresh when live mode is active
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("flarestack_daterange", JSON.stringify(dateRange));
    }

    if (!dateRange.live) return;

    const intervalMs = (dateRange.refreshInterval || 10) * 1000;
    const timer = setInterval(() => {
      if (!isPaused) {
        setIsLoading(true);
        router.refresh();
        // Since refresh is asynchronous, we can clear loading state shortly after
        setTimeout(() => setIsLoading(false), 500);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [dateRange, isPaused, router]);

  const handleRefresh = async () => {
    setIsLoading(true);
    router.refresh();
    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <div className="pb-8">
      {accounts.length === 0 && currentTab === "cloudflare" && (
        <div className="mb-8 flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
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

      {vercelAccounts.length === 0 && currentTab === "vercel" && (
        <div className="mb-8 flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="w-9 h-9 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">No Vercel account connected</p>
            <p className="text-xs text-amber-700 mt-0.5">Connect a Vercel account before adding projects.</p>
          </div>
          <button onClick={() => setIsVercelAccountModalOpen(true)} className="flex-shrink-0 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors">
            Connect Account
          </button>
        </div>
      )}

      {currentTab === "cloudflare" && (
        <Cloudflare
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          isLoading={isLoading}
          accounts={accounts}
          zones={zones}
          rules={rules}
          recentActions={recentActions}
          totalBlocks={totalBlocks}
          onRefresh={handleRefresh}
          onAddAccount={() => setIsAccountModalOpen(true)}
          onAddZone={() => setIsZoneModalOpen(true)}
          onAddRule={(zoneId: string) => {
            setRuleModalZoneId(zoneId);
            setRuleModalTargetType('zone');
          }}
          error={undefined}
        />
      )}

      {currentTab === "vercel" && (
        <Vercel
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          isLoading={isLoading}
          vercelAccounts={vercelAccounts}
          vercelProjects={vercelProjects}
          rules={rules}
          recentActions={recentActions}
          totalBlocks={totalBlocks}
          onRefresh={handleRefresh}
          onAddVercelAccount={() => setIsVercelAccountModalOpen(true)}
          onAddVercelProject={() => setIsVercelProjectModalOpen(true)}
          onAddVercelRule={(projectId: string) => {
            setRuleModalZoneId(projectId);
            setRuleModalTargetType('vercel');
          }}
        />
      )}

      {currentTab === "ips" && (
        <TopStatsExplorer
          zones={zones}
          accounts={accounts}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          limit={limit}
          onLimitChange={setLimit}
          activeZoneId={activeZoneId}
          onActiveZoneChange={setActiveZoneId}
          isLoading={isLoading}
          onPauseChange={setIsPaused}
        />
      )}

      {currentTab === "logs" && (
        <ActionLogs
          zones={zones}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          limit={limit}
          onLimitChange={setLimit}
          activeZoneId={activeZoneId}
          onActiveZoneChange={setActiveZoneId}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          recentActions={recentActions}
        />
      )}

      {currentTab === "lists" && (
        <Lists
          accounts={accounts}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          limit={limit}
          onLimitChange={setLimit}
          isLoading={isLoading}
          onPauseChange={setIsPaused}
        />
      )}

      {currentTab === "profile" && (
        <Profile user={user} />
      )}

      {isAccountModalOpen && (
        <AddAccount
          onClose={() => setIsAccountModalOpen(false)}
          onRefresh={handleRefresh}
        />
      )}

      {isZoneModalOpen && (
        <AddZone
          onClose={() => setIsZoneModalOpen(false)}
          accounts={accounts}
          onRefresh={handleRefresh}
        />
      )}

      {isVercelProjectModalOpen && (
        <AddVercelProject
          onClose={() => setIsVercelProjectModalOpen(false)}
          accounts={vercelAccounts}
          onRefresh={handleRefresh}
        />
      )}

      {isVercelAccountModalOpen && (
        <AddVercelAccount
          onClose={() => setIsVercelAccountModalOpen(false)}
          onRefresh={handleRefresh}
        />
      )}

      {ruleModalZoneId && !selectedRuleType && (
        <RuleSelector
          onClose={() => setRuleModalZoneId(null)}
          onSelect={(type: RuleType) => setSelectedRuleType(type)}
          targetType={ruleModalTargetType}
        />
      )}

      {(() => {
        const config = ruleModalZoneId && selectedRuleType ? RULE_REGISTRY[selectedRuleType] : null;
        const AddComponent = config?.addComponent;
        if (!AddComponent) return null;

        return (
          <AddComponent
            onClose={() => {
              setRuleModalZoneId(null);
              setSelectedRuleType(null);
            }}
            isSubmitting={false}
            zoneId={ruleModalZoneId!}
            accounts={accounts}
            zones={zones}
            config={config}
          />
        );
      })()}
    </div>
  );
}
