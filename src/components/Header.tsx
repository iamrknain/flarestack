"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Logo } from "~/components/Logo";

import { logoutAction } from "~/server/auth";

interface HeaderProps {
    onToggleSidebar?: () => void;
    user?: any;
}

export function Header({ onToggleSidebar, user }: HeaderProps) {
    const [isUserOpen, setIsUserOpen] = useState(false);

    const router = useRouter();
    const pathname = usePathname();
    const userRef = useRef<HTMLDivElement>(null);

    const isHome = pathname === "/";
    const isDashboard = pathname.startsWith("/dashboard");
    const isDashboardPath = pathname.startsWith("/dashboard");
    const activeTab = pathname.split("/")[2] || "overview";

    let pageTitle = "";
    let pageSubtext = "";

    if (isDashboard) {
        if (activeTab === "overview") {
            pageTitle = "Overview";
            pageSubtext = "Monitor and manage your edge defenses in real-time.";
        } else if (activeTab === "cloudflare") {
            pageTitle = "Cloudflare";
            pageSubtext = "Configure automated rate limiting, IP list block rules, and WAF rulesets for your zones.";
        } else if (activeTab === "vercel") {
            pageTitle = "Vercel";
            pageSubtext = "Manage edge bot protection, challenge mode, and request blocking configurations for your projects.";
        } else if (activeTab === "stats") {
            pageTitle = "Stats";
            pageSubtext = "Analyze traffic patterns by IP, country, ASN and more. Take action on selected results.";
        } else if (activeTab === "logs") {
            pageTitle = "Action Logs";
            pageSubtext = "Complete history of all mitigations and security actions.";
        } else if (activeTab === "lists") {
            pageTitle = "Lists";
            pageSubtext = "Manage your Cloudflare Lists for IP, ASN, and Hostname filtering.";
        } else if (activeTab === "profile") {
            pageTitle = "Profile";
            pageSubtext = "Manage your organization and account preferences.";
        }
    }

    const handleSignOut = async () => {
        try {
            await logoutAction();
            router.push("/login");
            setIsUserOpen(false);
            router.refresh();
        } catch (err) {
            console.error("Sign out failed:", err);
        }
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (userRef.current && !userRef.current.contains(e.target as Node)) setIsUserOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <>
            {/* ── Header bar ─────────────────────────────────────────── */}
            <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 flex-shrink-0">
                <div className={`${isDashboardPath ? "px-4 md:px-6" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"} h-16 flex items-center text-slate-900`}>

                    {/* 📱 MOBILE NAVIGATION (Order: Toggle, Logo+Name, Dashboard Link, Spacer, Org, User) */}
                    <div className="flex md:hidden items-center gap-2 w-full">
                        {onToggleSidebar && (
                            <button
                                onClick={onToggleSidebar}
                                className="p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                aria-label="Toggle Sidebar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                            </button>
                        )}

                        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                            <Logo variant="icon" size={26} animate={false} />
                            <span className="text-sm font-black tracking-tight text-slate-900">FlareStack</span>
                        </Link>

                        {!isDashboardPath && user && (
                            <>
                                <div className="ml-3 h-5 w-px bg-slate-200 flex-shrink-0" />
                                <Link
                                    href="/dashboard"
                                    className="ml-1 h-9 px-4 flex items-center font-semibold bg-slate-50/50 hover:bg-slate-100 active:scale-95 rounded-md transition-all flex-shrink-0"
                                >
                                    Dashboard
                                </Link>
                            </>
                        )}

                        <div className="flex-1" />

                        <div ref={userRef} className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setIsUserOpen(!isUserOpen); }} className="block focus:outline-none">
                                <UserAvatar name={user?.name || "U"} />
                            </button>
                            {isUserOpen && (
                                <Dropdown className="right-0 w-56 mt-2">
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                                        <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
                                    </div>
                                    <div className="p-1.5 space-y-0.5">
                                        <DropdownItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>} onClick={() => { router.push("/dashboard"); setIsUserOpen(false); }}>Dashboard</DropdownItem>
                                        <DropdownItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} onClick={() => { router.push("/dashboard/profile"); setIsUserOpen(false); }}>Profile</DropdownItem>
                                        <DropdownItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>} onClick={handleSignOut} danger>Sign Out</DropdownItem>
                                    </div>
                                </Dropdown>
                            )}
                        </div>
                    </div>

                    {/* 🖥️ DESKTOP NAVIGATION (Restored Original Layout) */}
                    <div className="hidden md:flex items-center justify-between w-full">
                        <div className="flex items-center gap-4">
                            {onToggleSidebar && (
                                <button
                                    onClick={onToggleSidebar}
                                    className="md:hidden p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-50"
                                    aria-label="Toggle Sidebar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                </button>
                            )}

                            {!isDashboardPath && (
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <Link
                                        href="/"
                                        className="flex items-center gap-2.5 flex-shrink-0"
                                    >
                                        <Logo variant="icon" size={30} animate={false} />
                                        <span className="text-base font-black tracking-tight text-slate-900 hidden sm:block">
                                            FlareStack
                                        </span>
                                    </Link>
                                    <div className="group relative hidden sm:block">
                                        <button className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-200 transition-all border border-slate-200/50">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                            </svg>
                                        </button>
                                        <div className="absolute left-0 top-full mt-3 w-72 p-4 bg-slate-950 text-white text-[12px] font-medium rounded-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 leading-relaxed border border-white/10 pointer-events-none">
                                            <div className="absolute -top-1 left-4 w-2.5 h-2.5 bg-slate-950 rotate-45" />
                                            <p className="opacity-90">Edge-native automated IP reputation and blocking system for Cloudflare WAF.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isDashboardPath && pageTitle && (
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <h1 className="text-xl font-black tracking-tighter text-slate-950">
                                        {pageTitle}
                                    </h1>
                                    <div className="group relative hidden sm:block">
                                        <button className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-200 transition-all border border-slate-200/50">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                            </svg>
                                        </button>
                                        <div className="absolute left-0 top-full mt-3 w-72 p-4 bg-slate-950 text-white text-[12px] font-medium rounded-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 leading-relaxed border border-white/10 pointer-events-none">
                                            <div className="absolute -top-1 left-4 w-2.5 h-2.5 bg-slate-950 rotate-45" />
                                            <p className="opacity-90">{pageSubtext}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        {!isDashboardPath && <div className="hidden md:block h-5 w-px bg-slate-200 flex-shrink-0 mx-2" />}

                        {/* Desktop nav links */}
                        {!isDashboardPath && (
                            <nav className="hidden md:flex items-center gap-1">
                                <NavLink href="/" active={isHome}>Home</NavLink>
                                {user && <NavLink href="/dashboard" active={isDashboard}>Dashboard</NavLink>}
                            </nav>
                        )}

                        {/* Push right */}
                        <div className="flex-1" />

                        {/* Desktop right side */}
                        <div className="hidden md:flex items-center gap-3">
                            {/* User / Get Started */}
                            {user ? (
                                <div className="relative" ref={userRef}>
                                    <button
                                        onClick={() => setIsUserOpen(!isUserOpen)}
                                        className="flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                                    >
                                        <UserAvatar name={user.name} />
                                        <span className="text-sm font-semibold text-slate-700 max-w-[100px] truncate hidden lg:block">
                                            {user.name}
                                        </span>
                                        <Chevron open={isUserOpen} />
                                    </button>

                                    {isUserOpen && (
                                        <Dropdown className="right-0 w-56">
                                            <div className="px-4 py-3 border-b border-slate-100">
                                                <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                                                <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                                            </div>
                                            <div className="p-1.5 space-y-0.5">
                                                <DropdownItem
                                                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>}
                                                    onClick={() => { router.push("/dashboard"); setIsUserOpen(false); }}
                                                >Dashboard</DropdownItem>
                                                <DropdownItem
                                                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                                                    onClick={() => { router.push("/dashboard/profile"); setIsUserOpen(false); }}
                                                >Profile</DropdownItem>
                                                <DropdownItem
                                                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
                                                    onClick={handleSignOut}
                                                    danger
                                                >Sign Out</DropdownItem>
                                            </div>
                                        </Dropdown>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1.5 h-9 px-4 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-black transition-all active:scale-95"
                                >
                                    Get Started
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
}

// ── Small reusable pieces ───────────────────────────────────────────────────

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`h-9 px-4 flex items-center font-semibold rounded-md transition-all active:scale-95 ${active ? "text-slate-900 bg-slate-100" : "text-slate-500 bg-slate-50/50 hover:bg-slate-100 hover:text-slate-900"
                }`}
        >
            {children}
        </Link>
    );
}

function Dropdown({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`absolute top-full mt-2 bg-white border border-slate-200 rounded-md shadow-lg shadow-slate-900/10 z-[60] overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

function DropdownItem({ icon, onClick, danger, children }: { icon: React.ReactNode; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"
                }`}
        >
            {icon}
            {children}
        </button>
    );
}

function Chevron({ open }: { open: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

function UserAvatar({ name }: { name: string }) {
    return (
        <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {name.charAt(0).toUpperCase()}
        </div>
    );
}
