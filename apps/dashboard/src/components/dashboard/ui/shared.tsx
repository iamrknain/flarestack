// ─── Shared CSS constants ──────────────────────────────────────────────────────
export const inputCls = "w-full px-4 py-2 rounded-md border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-colors";
export const monoCls = `${inputCls} font-mono`;
export const labelCls = "block text-sm font-bold text-black mb-1.5";
export const sectionLabelCls = "text-[10px] font-black text-black/60 uppercase tracking-[0.1em] mb-3";

// ─── Subtle Section Backgrounds ───────────────────────────────────────────────
export const subtleIndigoCls = "bg-gradient-to-br from-white to-indigo-50/50 border border-indigo-100 rounded-md p-5";
export const subtleBlueCls = "bg-gradient-to-br from-white to-blue-50/50 border border-blue-100 rounded-md p-5";
export const subtleNeutralCls = "bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/60 rounded-md p-5";
export const glassCls = "bg-white border border-gray-200 shadow-sm rounded-md";

export function ModalShell({ onClose, icon, iconBg, title, subtitle, children }: {
    onClose: () => void;
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-md shadow-2xl w-full max-w-lg relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${iconBg}`}>{icon}</div>
                        <div>
                            <h2 className="text-base font-bold text-black">{title}</h2>
                            <p className="text-xs text-black font-medium">{subtitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-black hover:text-black hover:bg-gray-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function FormActions({ onClose, isSubmitting, submitLabel }: {
    onClose: () => void;
    isSubmitting: boolean;
    submitLabel: string;
}) {
    return (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 py-2.5 rounded-md text-sm font-bold text-black bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">
                Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSubmitting ? (
                    <>
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Saving…
                    </>
                ) : submitLabel}
            </button>
        </div>
    );
}
