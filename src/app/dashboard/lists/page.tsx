"use client";

import { useState, useEffect } from "react";
import { Lists } from "~/components/dashboard/Lists";
import { getListsDataAction } from "~/server/cloudflare";
import { useDashboardState } from "~/hooks/useDashboardState";

export default function ListsPage() {
  const {
    dateRange,
    setDateRange,
    limit,
    setLimit,
    isLoading,
    setIsPaused,
  } = useDashboardState(10, "lists", { type: "all", live: false, refreshInterval: 15 });

  const [data, setData] = useState<{
    accounts: any[];
  } | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function load() {
      setFetching(true);
      const res = await getListsDataAction();
      if (res.success && res.data) {
        setData(res.data);
      }
      setFetching(false);
    }
    load();
  }, []);

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

  return (
    <div className="pb-8 px-6 pt-6">
      <Lists
        accounts={accounts}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        limit={limit}
        onLimitChange={setLimit}
        isLoading={isLoading || fetching}
        onPauseChange={setIsPaused}
      />
    </div>
  );
}
