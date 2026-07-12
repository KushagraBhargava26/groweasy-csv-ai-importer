import { Leaf } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  title: string;
  subtitle: string;
}

/**
 * Single unified top bar — branding + page title on the left, dark mode
 * toggle on the right. No help icon or account/team display — neither
 * a help system nor real auth/accounts exist in this app, so both would
 * be fake affordances.
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

      <ThemeToggle />
    </header>
  );
}
