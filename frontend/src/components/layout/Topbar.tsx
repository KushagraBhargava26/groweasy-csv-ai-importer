interface TopbarProps {
  title: string;
  subtitle: string;
}

/**
 * Page header bar. Takes title/subtitle as props rather than being
 * hardcoded, since later steps might reuse this shell for different
 * page states (though for this assignment's scope, one page is enough).
 */
export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </header>
  );
}