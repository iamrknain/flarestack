"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserContext } from "~/context/UserContext";
import { updateProfileAction } from "~/server/auth";
import { glassCls, inputCls } from "~/components/dashboard/ui/shared";
import CronTokenGenerator from "~/components/dashboard/CronTokenGenerator";

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: fetching, refreshUser: loadUser } = useUserContext();
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setNewName(user.name || "");
        }
    }, [user]);

    const formatDate = (date: string | number | Date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleUpdateName = async () => {
        if (!newName.trim()) return;
        setIsSaving(true);
        const fd = new FormData();
        fd.append("intent", "update_profile");
        fd.append("name", newName.trim());
        const res = await updateProfileAction(fd);
        setIsSaving(false);
        if (res?.success) {
            setIsEditingName(false);
            loadUser();
            router.refresh();
        } else {
            alert(res?.error || "Failed to update profile name");
        }
    };

    if (!user && fetching) {
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

    return (
        <div className="px-6 py-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* ─── Profile Details Card ─── */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <section className={`${glassCls} overflow-hidden shadow-sm relative`}>
                        {/* Elegant top gradient banner */}
                        <div className="h-24 bg-gradient-to-r from-slate-900 to-indigo-950" />
                        
                        <div className="px-6 pb-6 relative">
                            {/* Avatar offset */}
                            <div className="flex justify-between items-end -mt-10 mb-5">
                                <div className="relative">
                                    {user.image ? (
                                        <img src={user.image} className="w-20 h-20 rounded-xl border-4 border-white shadow-md object-cover bg-white" alt="" />
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl bg-slate-950 text-white flex items-center justify-center text-3xl font-black border-4 border-white shadow-md">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center" title="Online">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                    </span>
                                </div>
                                
                                <button
                                    onClick={() => setIsEditingName(!isEditingName)}
                                    className="bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black px-3 py-2 rounded-md border border-slate-200 hover:border-slate-300 transition-all shadow-sm uppercase tracking-wider flex items-center gap-1.5"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                                    </svg>
                                    {isEditingName ? "Cancel" : "Edit Name"}
                                </button>
                            </div>

                            {/* User details */}
                            <div className="space-y-5">
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                            </svg>
                                            Administrator
                                        </span>
                                    </div>
                                    {isEditingName ? (
                                        <div className="flex flex-col gap-2 mt-3">
                                            <input
                                                type="text"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className={inputCls}
                                                placeholder="Enter full name"
                                                autoFocus
                                            />
                                            <div className="flex gap-2 justify-end mt-1">
                                                <button 
                                                    onClick={() => setIsEditingName(false)} 
                                                    className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={handleUpdateName} 
                                                    disabled={isSaving} 
                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                                                >
                                                    {isSaving ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <h2 className="text-lg font-black text-slate-900 leading-tight">{user.name}</h2>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-100 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0 border border-slate-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Email address</p>
                                            <p className="text-xs font-bold text-slate-700 truncate" title={user.email}>{user.email}</p>
                                        </div>
                                    </div>

                                    {user.createdAt && (
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0 border border-slate-100">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Member since</p>
                                                <p className="text-xs font-bold text-slate-700">{formatDate(user.createdAt)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* ─── Cron API Token Card ─── */}
                <div className="lg:col-span-8">
                    <CronTokenGenerator />
                </div>
            </div>
        </div>
    );
}
