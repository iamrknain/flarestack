"use client";

import { useState, useEffect } from "react";
import { ActivityLogs } from "~/components/dashboard/ActivityLogs";
import { getActivityDataAction } from "~/server/activity";
import { useDashboardState } from "~/hooks/useDashboardState";

export default function ActivityPage() {
  const {
    dateRange,
    setDateRange,
    limit,
    setLimit,
    activeZoneId,
    setActiveZoneId,
    searchQuery,
    setSearchQuery,
    isLoading,
    handleRefresh,
    refreshTrigger,
    setIsPaused,
  } = useDashboardState(100, "activity");

  const [data, setData] = useState<{
    zones: any[];
    projects: any[];
    recentActions: any[];
  } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [deepSearchActive, setDeepSearchActive] = useState(false);

  const loadData = async (forceQuery?: string) => {
    setFetching(true);
    const paramsObj: any = {
      type: dateRange.type,
      relative: dateRange.relativeValue,
      start: dateRange.start?.toISOString(),
      end: dateRange.end?.toISOString(),
      live: dateRange.live,
      limit: limit,
    };
    if (activeZoneId) {
      paramsObj.zoneId = activeZoneId;
    }

    const activeQ = typeof forceQuery === "string" ? forceQuery : (deepSearchActive ? searchQuery : "");
    if (activeQ.trim()) {
      paramsObj.q = activeQ.trim();
    }

    const res = await getActivityDataAction(paramsObj);
    if (res.success && res.data) {
      setData(res.data);
    }
    setFetching(false);
  };

  useEffect(() => {
    loadData();
  }, [dateRange, limit, activeZoneId, refreshTrigger]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setDeepSearchActive(false);
    }
  }, [searchQuery]);

  const handleDeepSearch = () => {
    setDeepSearchActive(true);
    loadData(searchQuery);
  };

  const handleClearDeepSearch = () => {
    setSearchQuery("");
    setDeepSearchActive(false);
  };

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

  const zones = data?.zones || [];
  const projects = data?.projects || [];
  const recentActions = data?.recentActions || [];

  return (
    <div className="pb-8 px-6 pt-6">
      <ActivityLogs
        zones={zones}
        projects={projects}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        limit={limit}
        onLimitChange={setLimit}
        activeZoneId={activeZoneId}
        onActiveZoneChange={setActiveZoneId}
        onRefresh={handleRefresh}
        isLoading={isLoading || fetching}
        recentActions={recentActions}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        deepSearchActive={deepSearchActive}
        onDeepSearch={handleDeepSearch}
        onClearDeepSearch={handleClearDeepSearch}
        onSelectionChange={(count: number) => setIsPaused(count > 0)}
      />
    </div>
  );
}
