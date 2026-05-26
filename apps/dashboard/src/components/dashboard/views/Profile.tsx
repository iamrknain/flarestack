import { useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardAction } from "~/app/dashboard/actions";
import { subtleIndigoCls, subtleNeutralCls, glassCls, sectionLabelCls } from "../ui/shared";

export function Profile({ user }: { user: any }) {
    const router = useRouter();
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user.name || "");
    const [isSaving, setIsSaving] = useState(false);

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
        const res = await dashboardAction(fd);
        setIsSaving(false);
        if (res?.success) {
            setIsEditingName(false);
            router.refresh();
        } else {
            alert(res?.error || "Failed to update profile name");
        }
    };

    return (
        <div className="flex flex-col gap-6 mt-10">


            <div className="px-4 flex flex-col gap-8 w-full pb-12">
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
                            <div className="hidden lg:block">
                                <p className={sectionLabelCls}>Created On</p>
                                <p className="text-[11px] font-bold text-slate-700">{formatDate(user.createdAt)}</p>
                            </div>
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

            </div>
        </div>
    );
}

