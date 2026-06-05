import { useState, useEffect } from "react";
import type { DateRange } from "~/components/DateRangePicker";

export function useDashboardState(
  defaultLimit: number = 10,
  pageKey?: string,
  defaultDateRange: DateRange = { type: "relative", relativeValue: "30m", live: false, refreshInterval: 10 }
) {
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const dateRangeKey = pageKey ? `flarestack_daterange_${pageKey}` : "flarestack_daterange";
  const limitKey = pageKey ? `flarestack_limit_${pageKey}` : "flarestack_limit";
  const zoneKey = pageKey ? `ff_top_stats_zone_${pageKey}` : "ff_top_stats_zone";

  const [dateRange, _setDateRange] = useState<DateRange>(() => {
    // Try localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(dateRangeKey);
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
    return defaultDateRange;
  });

  const [limit, _setLimit] = useState<number>(() => {
    // LocalStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(limitKey);
      if (saved) return parseInt(saved);
    }
    return defaultLimit;
  });

  const [activeZoneId, _setActiveZoneId] = useState<string>(() => {
    // LocalStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(zoneKey);
      if (saved) return saved;
    }
    return "";
  });

  const [searchQuery, setSearchQuery] = useState<string>("");

  const setDateRange = (newRange: DateRange) => {
    _setDateRange(newRange);
    if (typeof window !== "undefined") {
      localStorage.setItem(dateRangeKey, JSON.stringify(newRange));
    }
  };

  const setLimit = (newLimit: number) => {
    _setLimit(newLimit);
    if (typeof window !== "undefined") {
      localStorage.setItem(limitKey, String(newLimit));
    }
  };

  const setActiveZoneId = (zId: string) => {
    _setActiveZoneId(zId);
    if (typeof window !== "undefined") {
      localStorage.setItem(zoneKey, zId);
    }
  };

  // Periodic refresh when live mode is active
  useEffect(() => {
    if (!dateRange.live) return;

    const intervalMs = (dateRange.refreshInterval || 10) * 1000;
    const timer = setInterval(() => {
      if (!isPaused) {
        setIsLoading(true);
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setIsLoading(false), 500);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [dateRange, isPaused]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setIsLoading(false), 500);
  };

  return {
    dateRange,
    setDateRange,
    limit,
    setLimit,
    activeZoneId,
    setActiveZoneId,
    searchQuery,
    setSearchQuery,
    isPaused,
    setIsPaused,
    isLoading,
    handleRefresh,
    refreshTrigger,
  };
}
