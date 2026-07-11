import { Topbar } from "@/components/layout/Topbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Topbar
        title="Import Leads"
        subtitle="Upload CSV and let AI extract lead information"
      />
      <div className="p-8">{/* Step content will go here */}</div>
    </main>
  );
}