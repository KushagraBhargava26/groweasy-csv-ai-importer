import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  title: string;
  subtitle: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <ThemeToggle />
    </header>
  );
}