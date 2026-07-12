"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Pill-style toggle switch matching the reference design — a sun/moon icon
 * label plus a sliding switch, wired to the real ThemeContext (not
 * decorative). Clicking anywhere on the pill toggles dark mode app-wide.
 */
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      aria-label="Toggle dark mode"
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
      <span>Dark Mode</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          isDark ? "bg-indigo-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            isDark ? "translate-x-4.5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}