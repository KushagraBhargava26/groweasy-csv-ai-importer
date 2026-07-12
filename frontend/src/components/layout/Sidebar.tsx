import { Upload, Leaf } from "lucide-react";

/**
 * Rebranded to GrowEasy per the reference design. Dark-mode classes added
 * throughout (dark:bg-slate-950 etc.) — note the sidebar was ALREADY dark
 * in our original design, so most changes here are branding, not theme
 * logic; the dark: classes matter more in Topbar and the main content area.
 */
export function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 dark:bg-slate-950 text-slate-100 flex flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
          <Leaf size={18} className="text-white" />
        </div>
        <span className="font-semibold">GrowEasy</span>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm">
          <Upload size={18} />
          Import Leads
        </div>
      </nav>

      <div className="px-6 py-4 border-t border-slate-800 text-xs text-slate-400">
        GrowEasy CRM Importer
      </div>
    </aside>
  );
}