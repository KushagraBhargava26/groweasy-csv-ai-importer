import { Upload } from "lucide-react";

/**
 * Static sidebar shell. Only one functional nav item exists (Import Leads),
 * matching the reference design's visual style without building out pages
 * we don't need for this assignment (History, Settings, API Keys, etc.
 * are intentionally omitted — they'd imply persistence/auth this project
 * doesn't have, and aren't part of the graded scope).
 */
export function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-semibold text-sm">
          AI
        </div>
        <span className="font-semibold">CSV Importer</span>
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