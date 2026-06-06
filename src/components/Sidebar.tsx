"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Logo } from "~/components/Logo";

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("sidebar-collapsed");
        if (saved === "true") setIsCollapsed(true);
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("sidebar-collapsed", isCollapsed.toString());
        }
    }, [isCollapsed, isLoaded]);

    const isDashboard = pathname.startsWith("/dashboard");
    const currentTab = pathname.split("/")[2] || "overview";

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside
                className={[
                    "transition-all duration-300 ease-in-out flex flex-col",
                    isCollapsed ? "md:w-20" : "md:w-72",
                    "md:sticky md:top-0 md:h-screen md:flex md:flex-shrink-0 md:translate-x-0 md:shadow-none md:z-0",
                    "fixed top-0 bottom-0 left-0 z-50 w-72",
                    "bg-white border-r border-slate-200",
                    isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
                ].join(" ")}
            >
                <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 flex-shrink-0">
                    <Logo variant="icon" size={32} animate={false} className="flex-shrink-0" />
                    {!isCollapsed && (
                        <span className="text-lg font-black truncate tracking-tight text-slate-900 uppercase">
                            FlareStack
                        </span>
                    )}
                </div>

                <nav className="flex-1 px-2 py-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Home Link */}
                    <div className="space-y-1">
                        <Link
                            href="/"
                            className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm`}
                        >
                            <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                            {!isCollapsed && <span className="truncate">Home</span>}
                        </Link>
                    </div>

                    {/* Dashboard Section */}
                    <div className="space-y-2">
                        {!isCollapsed && (
                            <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                Dashboard
                            </div>
                        )}
                        <div className="space-y-1">
                            <Link
                                href="/dashboard/cloudflare"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} ${isDashboard && currentTab === "cloudflare"
                                    ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-100"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                                    }`}
                                title={isCollapsed ? "Cloudflare" : ""}
                            >
                                <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42 0-.83.04-1.24.11a4.5 4.5 0 0 0-8.87-.22c-.22-.05-.44-.08-.66-.08-2.5 0-4.5 2-4.5 4.5S4 20 6.5 20h11" />
                                </svg>
                                {!isCollapsed && <span className="truncate">Cloudflare</span>}
                            </Link>

                            <Link
                                href="/dashboard/vercel"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} ${isDashboard && currentTab === "vercel"
                                    ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-100"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                                    }`}
                                title={isCollapsed ? "Vercel" : ""}
                            >
                                <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m12 3-10 18h20z" />
                                </svg>
                                {!isCollapsed && <span className="truncate">Vercel</span>}
                            </Link>

                            <Link
                                href="/dashboard/ips"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} ${isDashboard && currentTab === "ips"
                                    ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-100"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                                    }`}
                                title={isCollapsed ? "Top Stats" : ""}
                            >
                                <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                                {!isCollapsed && <span className="truncate">Top Stats</span>}
                            </Link>

                             <Link
                                href="/dashboard/activity"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} ${isDashboard && currentTab === "activity"
                                    ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-100"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                                    }`}
                                title={isCollapsed ? "Activity Log" : ""}
                            >
                                <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                                </svg>
                                {!isCollapsed && <span className="truncate">Activity Log</span>}
                            </Link>

                            <Link
                                href="/dashboard/lists"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} ${isDashboard && currentTab === "lists"
                                    ? "bg-indigo-50 text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-100"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                                    }`}
                                title={isCollapsed ? "Lists" : ""}
                            >
                                <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
                                </svg>
                                {!isCollapsed && <span className="truncate">Lists</span>}
                            </Link>
                        </div>
                    </div>

                    {/* Profile Section */}
                    <Link
                        href="/dashboard/profile"
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-bold transition-all ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""} ${isDashboard && currentTab === "profile"
                            ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-100"
                            : "text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                            }`}
                        title={isCollapsed ? "Profile" : ""}
                    >
                        <svg className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        {!isCollapsed && <span className="truncate">Profile</span>}
                    </Link>
                </nav>

                <div className="hidden md:flex flex-col border-t border-slate-200/50 p-4 bg-slate-50/30">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm ${isCollapsed ? "justify-center px-0 w-12 mx-auto" : ""}`}
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
                        >
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        {!isCollapsed && <span>Collapse Menu</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
