"use client";

import { useState, useEffect } from "react";
import { getVercelProjectsAction, addVercelProject, editVercelProject } from "~/server/vercel";
import { ModalShell, FormActions, inputCls, labelCls, sectionLabelCls } from "../ui/shared";

export function AddVercelProject({
    onClose,
    accounts,
    onRefresh,
    project,
}: {
    onClose: () => void;
    accounts: any[];
    onRefresh?: () => void;
    project?: any;
}) {
    const [selectedAccount, setSelectedAccount] = useState(project ? project.vercelAccountRef : "");
    const [discoveredProjects, setDiscoveredProjects] = useState<any[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState(project ? project.vercelProjectId : "");

    const selectedProjObj = discoveredProjects.find((p) => p.id === selectedProjectId);

    useEffect(() => {
        if (selectedAccount) {
            setIsFetchingProjects(true);
            getVercelProjectsAction(selectedAccount)
                .then((data) => {
                    if (Array.isArray(data)) {
                        setDiscoveredProjects(data);
                    } else {
                        setDiscoveredProjects([]);
                    }
                })
                .catch(() => setDiscoveredProjects([]))
                .finally(() => setIsFetchingProjects(false));
        } else {
            setDiscoveredProjects([]);
        }
    }, [selectedAccount]);

    const handleAccountChange = (val: string) => {
        setSelectedAccount(val);
        setSelectedProjectId("");
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const vercelProjectId = formData.get("vercelProjectId") as string;
        const vercelAccountRef = formData.get("vercelAccountRef") as string;
        const domain = selectedProjObj?.domain || (project && project.vercelProjectId === vercelProjectId ? project.domain : null);

        const result = project
            ? await editVercelProject(project.id, name, vercelProjectId, vercelAccountRef, domain)
            : await addVercelProject(name, vercelProjectId, vercelAccountRef, domain);

        setIsSubmitting(false);
        if (result?.error) {
            setError(result.error);
        } else {
            onClose();
            if (onRefresh) onRefresh();
        }
    };

    return (
        <ModalShell
            onClose={onClose}
            iconBg="bg-indigo-100"
            title={project ? "Edit Vercel Project" : "Add Vercel Project"}
            subtitle={project ? "Update name, account or project settings" : "Register a direct Vercel project to enable edge protection and log traffic"}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <polygon points="12 2 2 22 22 22" />
                </svg>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-5 space-y-5 transition-all hover:bg-white hover:shadow-sm">
                    <p className={sectionLabelCls}>Project Identity</p>
                    <div className="space-y-4">
                        <div>
                            <label className={labelCls}>Website Name <span className="text-rose-500">*</span></label>
                            <input type="text" name="name" defaultValue={project?.name || ""} placeholder='e.g. "My Vercel Site"' required className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Vercel Account <span className="text-rose-500">*</span></label>
                            <select
                                name="vercelAccountRef"
                                required
                                className={inputCls}
                                value={selectedAccount}
                                onChange={(e) => handleAccountChange(e.target.value)}
                            >
                                <option value="">Select Vercel account…</option>
                                {accounts.map((a: any) => (
                                    <option key={a.id} value={a.id}>
                                        {a.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Select Project (Vercel Project ID) <span className="text-rose-500">*</span></label>
                            <select
                                name="vercelProjectId"
                                required
                                className={inputCls}
                                disabled={!selectedAccount || isFetchingProjects}
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">
                                    {isFetchingProjects
                                        ? "Discovering projects..."
                                        : discoveredProjects.length > 0
                                        ? "Select project..."
                                        : project && project.vercelAccountRef === selectedAccount
                                        ? `Selected: ${project.name}`
                                        : "Pick a Vercel account first"}
                                </option>
                                {discoveredProjects.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.id.slice(0, 8)}…)
                                    </option>
                                ))}
                                {project && project.vercelAccountRef === selectedAccount && !discoveredProjects.some(p => p.id === project.vercelProjectId) && (
                                    <option value={project.vercelProjectId}>
                                        {project.name} ({project.vercelProjectId.slice(0, 8)}…)
                                    </option>
                                )}
                            </select>
                            {discoveredProjects.length === 0 && selectedAccount && !isFetchingProjects && (!project || project.vercelAccountRef !== selectedAccount) && (
                                <p className="mt-1 text-[10px] text-rose-500 font-bold italic select-none uppercase tracking-tight">
                                    No projects found. Check token permissions or team ID scope.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mx-6 -mt-1 flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md px-4 py-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p className="text-xs font-semibold leading-relaxed">{error}</p>
                    </div>
                )}
                <FormActions onClose={onClose} isSubmitting={isSubmitting} submitLabel={project ? "Save Changes" : "Add Project"} />
            </form>
        </ModalShell>
    );
}
