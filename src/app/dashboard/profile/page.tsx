"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "~/hooks/useUser";
import { updateProfileAction } from "~/server/auth";
import { subtleIndigoCls, subtleNeutralCls, glassCls, sectionLabelCls } from "~/components/dashboard/ui/shared";
import CronTokenGenerator from "~/components/dashboard/CronTokenGenerator";

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: fetching, mutate: loadUser } = useUser();
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
        setIsSaving(true);
        const fd = new FormData();
        fd.append("intent", "update_profile");
        fd.append("name", newName);
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
        <div className="flex flex-col gap-6 mt-10 px-6 pb-8">
            <div className="flex flex-col gap-8 w-full">
                {/* ─── Card 1: User Profile Row ─── */}
                <section className={`${glassCls} overflow-hidden shadow-sm`}>
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-1 h-3 bg-indigo-500 rounded-full" />
                            <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Profile</h2>
                        </div>
                    </div>

                    <div className="p-4 flex flex-col md:flex-row items-center gap-6 md:gap-10">
                        <div className="relative shrink-0">
                            {user.image ? (
                                <img src={user.image} className="w-14 h-14 rounded-md border-2 border-white shadow-md object-cover" alt="" />
                            ) : (
                                <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center text-slate-800 text-xl font-black border-2 border-white shadow-md">
                                    {user.name?.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex flex-wrap items-center gap-x-10 gap-y-4 w-full">
                            <div className="min-w-0">
                                <p className={sectionLabelCls}>Name</p>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="text-sm font-bold border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                        <button onClick={handleUpdateName} disabled={isSaving} className="text-[10px] font-black text-emerald-600 uppercase disabled:opacity-50">
                                            {isSaving ? "Saving..." : "Save"}
                                        </button>
                                        <button onClick={() => setIsEditingName(false)} disabled={isSaving} className="text-[10px] font-black text-slate-400 uppercase disabled:opacity-50">Cancel</button>
                                    </div>
                                ) : (
                                    <p className="text-sm font-black text-slate-900 truncate">{user.name}</p>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className={sectionLabelCls}>Email</p>
                                <p className="text-xs font-bold text-slate-600 truncate">{user.email}</p>
                            </div>
                            {user.createdAt && (
                                <div className="hidden lg:block">
                                    <p className={sectionLabelCls}>Created On</p>
                                    <p className="text-[11px] font-bold text-slate-700">{formatDate(user.createdAt)}</p>
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 flex items-center gap-3">
                            <button
                                onClick={() => setIsEditingName(!isEditingName)}
                                className="bg-white hover:bg-slate-50 text-slate-900 text-[10px] font-black px-4 py-2.5 rounded-md border border-slate-200 transition-all shadow-sm uppercase tracking-widest"
                            >
                                {isEditingName ? "Discard Changes" : "Edit"}
                            </button>
                        </div>
                    </div>
                </section>

                {/* ─── Card 2: Cron API Token ─── */}
                <CronTokenGenerator />
            </div>
        </div>
    );
}
