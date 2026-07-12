import { Leaf, HelpCircle } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  title: string;
  subtitle: string;
}

/**
 * Single unified top bar — branding, page title, and account cluster all
 * in one row. No separate sidebar: this app has exactly one feature
 * (Import Leads), so a nav sidebar would imply sections that don't exist.
 * The "GrowEasy Team" text and avatar are static display only — no auth
 * or account switching exists, so there's no dropdown affordance.
 */
export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
            <Leaf size={18} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">GrowEasy</span>
        </div>

        <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />

        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <button
          className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Help"
        >
          <HelpCircle size={20} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-medium flex items-center justify-center">
            GB
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">GrowEasy Team</span>
        </div>
      </div>
    </header>
  );
}