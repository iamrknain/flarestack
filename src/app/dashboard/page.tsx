"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserContext } from "~/context/UserContext";
import { getCloudflareDataAction, getCloudflareRuleStatus } from "~/server/cloudflare";
import { getVercelDataAction, getVercelRuleStatus } from "~/server/vercel";
import { RecentActions } from "~/components/dashboard/RecentActions";
import { glassCls } from "~/components/dashboard/ui/shared";
import Link from "next/link";

export default function DashboardOverviewPage() {
    const router = useRouter();
    const { user, loading: userLoading } = useUserContext();
    const [cfData, setCfData] = useState<any>(null);
    const [vercelData, setVercelData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [liveData, setLiveData] = useState<any>(null);
    const [liveLoading, setLiveLoading] = useState(false);

    const fetchLiveStatus = async () => {
        setLiveLoading(true);
        try {
            const [cfLiveRes, vercelLiveRes] = await Promise.all([
                getCloudflareRuleStatus(),
                getVercelRuleStatus(),
            ]);

            const liveCf = cfLiveRes && "success" in cfLiveRes && cfLiveRes.success ? cfLiveRes.cloudflare : [];
            const liveVercel = vercelLiveRes && "success" in vercelLiveRes && vercelLiveRes.success ? vercelLiveRes.vercel : [];

            setLiveData({
                cloudflare: liveCf,
                vercel: liveVercel
            });
        } catch (err) {
            console.error("Failed to get live API status:", err);
        } finally {
            setLiveLoading(false);
        }
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch all-time recent actions
            const params = { type: "all" };
            const [cfRes, vercelRes] = await Promise.all([
                getCloudflareDataAction(params),
                getVercelDataAction(params),
            ]);

            if (cfRes.success && cfRes.data) {
                setCfData(cfRes.data);
            }
            if (vercelRes.success && vercelRes.data) {
                setVercelData(vercelRes.data);
            }
            
            // Trigger background live api check
            fetchLiveStatus();
        } catch (error) {
            console.error("Failed to load overview data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            loadDashboardData();
        }
    }, [user]);

    if (userLoading || (loading && !cfData && !vercelData)) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-6 text-slate-500 font-bold text-center">
                User profile not found. Please log in again.
            </div>
        );
    }

    // Stats calculations
    const cfZonesCount = cfData?.zones?.length || 0;
    const vercelProjectsCount = vercelData?.vercelProjects?.length || 0;

    // Combined recent activity logs sorted by timestamp descending
    const combinedActions = [
        ...(cfData?.recentActions || []),
        ...(vercelData?.recentActions || [])
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());



    return (
        <div className="flex flex-col gap-4 sm:gap-6 pb-8 px-6 pt-6 w-full">
            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/60 py-3 flex flex-row gap-2 items-center w-full overflow-x-auto scrollbar-hide shrink-0">
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={loadDashboardData}
                        disabled={loading}
                        className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-900 text-[10px] font-bold px-3 h-[34px] border border-slate-200 rounded-md shadow-sm transition-all active:scale-95 whitespace-nowrap"
                    >
                        {loading ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                        )}
                        Sync Status
                    </button>
                </div>
            </header>

            {/* ─── Highlights / Last Audit logs ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left side: Integrations & Overview Cards */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* ─── Protection Status by Zone/Project ─── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Cloudflare Zone Protections */}
                        <div className={`${glassCls} p-5 flex flex-col justify-between`}>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                                    Cloudflare Zone Protections
                                </h3>
                                
                                <div className="space-y-4">
                                    {cfZonesCount === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No zones configured.</p>
                                    ) : (
                                        cfData?.zones?.map((zone: any) => {
                                            const zoneRules = cfData?.rules?.filter((r: any) => r.zoneConfigId === zone.id) || [];
                                            const liveZone = liveData?.cloudflare?.find((z: any) => z.id === zone.id);

                                            return (
                                                <div key={zone.id} className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-md space-y-3">
                                                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                                                        <span className="text-xs font-black text-slate-900 truncate" title={zone.domain || zone.name}>
                                                            {zone.name}
                                                        </span>
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                                            zone.isActive 
                                                                ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
                                                                : "text-slate-500 bg-slate-100 border-slate-200"
                                                        }`}>
                                                            {zone.isActive ? "ACTIVE" : "INACTIVE"}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {!liveZone?.rules ? (
                                                            zoneRules.length === 0 ? (
                                                                <p className="text-[10px] text-slate-400 italic">No rules configured.</p>
                                                            ) : (
                                                                zoneRules.map((rule: any) => (
                                                                    <div key={rule.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100 shadow-sm opacity-60">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="font-bold text-slate-800 truncate">
                                                                                    {rule.name}
                                                                                </span>
                                                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                                                                    {rule.type === "under_attack_mode" ? "Under Attack Mode" : rule.type === "waf_rule" ? "WAF Custom Rule" : "IP List Auto-Block"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase text-slate-500 bg-slate-50 border-slate-200">
                                                                            ...
                                                                        </span>
                                                                    </div>
                                                                ))
                                                            )
                                                        ) : (
                                                            liveZone.rules.map((rule: any) => {
                                                                const isActive = rule.liveStatus === "ON";
                                                                return (
                                                                    <div key={rule.id} className="flex items-center justify-between gap-4 text-xs bg-white p-2 rounded border border-slate-100 shadow-sm">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                                                isActive
                                                                                    ? rule.type === "under_attack_mode"
                                                                                        ? "bg-rose-500 animate-pulse"
                                                                                        : "bg-indigo-500"
                                                                                    : "bg-slate-300"
                                                                            }`} />
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="font-bold text-slate-800 truncate" title={rule.name}>
                                                                                    {rule.name}
                                                                                </span>
                                                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                                                                    {rule.type === "under_attack_mode" ? "Under Attack Mode" : rule.type === "waf_rule" ? "WAF Custom Rule" : "IP List Auto-Block"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 items-end shrink-0">
                                                                            <div className="flex items-center gap-1 text-[9px]">
                                                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">LIVE:</span>
                                                                                <span className={`font-black px-1.5 py-0.5 rounded border text-[8px] uppercase ${
                                                                                    isActive
                                                                                        ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                                                                                        : "text-slate-500 bg-slate-50 border-slate-200"
                                                                                }`}>
                                                                                    {rule.liveStatus}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[9px]">
                                                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">FLARESTACK:</span>
                                                                                <span className={`font-black px-1.5 py-0.5 rounded border text-[8px] uppercase ${
                                                                                    rule.dbStatus === "ACTIVE"
                                                                                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                                                                        : rule.dbStatus === "INACTIVE"
                                                                                        ? "text-amber-700 bg-amber-50 border-amber-200"
                                                                                        : "text-slate-400 bg-slate-50 border-slate-100"
                                                                                }`}>
                                                                                    {rule.dbStatus}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            
                            <Link 
                                href="/dashboard/cloudflare"
                                className="mt-6 w-full text-center py-2 bg-slate-950 text-white rounded-md text-xs font-bold hover:bg-black transition-colors"
                            >
                                Manage Cloudflare
                            </Link>
                        </div>

                        {/* Vercel Project Protections */}
                        <div className={`${glassCls} p-5 flex flex-col justify-between`}>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                                    Vercel Project Protections
                                </h3>
                                
                                <div className="space-y-4">
                                    {vercelProjectsCount === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No projects configured.</p>
                                    ) : (
                                        vercelData?.vercelProjects?.map((project: any) => {
                                            const projectRules = vercelData?.rules?.filter((r: any) => r.vercelProjectRef === project.id) || [];
                                            const liveProj = liveData?.vercel?.find((p: any) => p.id === project.id);

                                            return (
                                                <div key={project.id} className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-md space-y-3">
                                                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                                                        <span className="text-xs font-black text-slate-900 truncate" title={project.domain || project.name}>
                                                            {project.name}
                                                        </span>
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                                            project.isActive 
                                                                ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
                                                                : "text-slate-500 bg-slate-100 border-slate-200"
                                                        }`}>
                                                            {project.isActive ? "ACTIVE" : "INACTIVE"}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {!liveProj?.rules ? (
                                                            projectRules.length === 0 ? (
                                                                <p className="text-[10px] text-slate-400 italic">No rules configured.</p>
                                                            ) : (
                                                                projectRules.map((rule: any) => (
                                                                    <div key={rule.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100 shadow-sm opacity-60">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="font-bold text-slate-800 truncate">
                                                                                    {rule.name}
                                                                                </span>
                                                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                                                                    {rule.type === "vercel_under_attack_mode" ? "Under Attack Mode" : "Bot Protection"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase text-slate-500 bg-slate-50 border-slate-200">
                                                                            ...
                                                                        </span>
                                                                    </div>
                                                                ))
                                                            )
                                                                                        ) : (
                                                            liveProj.rules.map((rule: any) => {
                                                                console.log("Vercel Live Rule:", rule);
                                                                const isActive = rule.liveStatus === "ON";
                                                                return (
                                                                    <div key={rule.id} className="flex items-center justify-between gap-4 text-xs bg-white p-2 rounded border border-slate-100 shadow-sm">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                                                isActive
                                                                                    ? rule.type === "vercel_under_attack_mode"
                                                                                        ? "bg-rose-500 animate-pulse"
                                                                                        : "bg-indigo-500"
                                                                                    : "bg-slate-300"
                                                                            }`} />
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="font-bold text-slate-800 truncate" title={rule.name}>
                                                                                    {rule.name}
                                                                                </span>
                                                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                                                                    {rule.type === "vercel_under_attack_mode" ? "Under Attack Mode" : "Bot Protection"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 items-end shrink-0">
                                                                            <div className="flex items-center gap-1 text-[9px]">
                                                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">LIVE:</span>
                                                                                <span className={`font-black px-1.5 py-0.5 rounded border text-[8px] uppercase ${
                                                                                    isActive
                                                                                        ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                                                                                        : "text-slate-500 bg-slate-50 border-slate-200"
                                                                                }`}>
                                                                                    {rule.liveStatus}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[9px]">
                                                                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">FLARESTACK:</span>
                                                                                <span className={`font-black px-1.5 py-0.5 rounded border text-[8px] uppercase ${
                                                                                    rule.dbStatus === "ACTIVE"
                                                                                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                                                                        : rule.dbStatus === "INACTIVE"
                                                                                        ? "text-amber-700 bg-amber-50 border-amber-200"
                                                                                        : "text-slate-400 bg-slate-50 border-slate-100"
                                                                                }`}>
                                                                                    {rule.dbStatus}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            
                            <Link 
                                href="/dashboard/vercel"
                                className="mt-6 w-full text-center py-2 bg-slate-950 text-white rounded-md text-xs font-bold hover:bg-black transition-colors"
                            >
                                Manage Vercel
                            </Link>
                        </div>
                        
                    </div>

                </div>

                {/* Right side: Combined Recent Actions list */}
                <div className="lg:col-span-4 h-[500px]">
                    <RecentActions 
                        actions={combinedActions} 
                        zones={cfData?.zones || []}
                        vercelProjects={vercelData?.vercelProjects || []}
                        title="Global Activity Log"
                        providerSplit={true}
                    />
                </div>

            </div>
        </div>
    );
}
