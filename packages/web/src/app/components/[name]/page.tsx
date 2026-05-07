import { loadAuditData, loadComponentData } from "@/lib/loadAuditData";
import { ScoreGauge } from "@/components/ScoreGauge";
import { CheckCard } from "@/components/CheckCard";
import { scoreColor } from "@/lib/utils";
import Link from "next/link";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function ComponentDetailPage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const component = loadComponentData(decodedName);
  const audit = loadAuditData();

  if (!component) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Component Not Found</h1>
          <p className="text-gray-600">
            No audit data found for &ldquo;{decodedName}&rdquo;
          </p>
          <Link href="/" className="text-blue-600 hover:underline mt-4 block">
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            Back to overview
          </Link>
          <h1 className="text-2xl font-bold">{component.componentName}</h1>
        </div>
        {audit && (
          <p className="text-gray-500 text-sm mt-1">{audit.meta.figmaFileName}</p>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-8 mb-8">
          <ScoreGauge score={component.score} />
          <div>
            <h2 className="text-xl font-semibold">Component Score</h2>
            <p className={`text-4xl font-bold ${scoreColor(component.score)}`}>
              {component.score}/100
            </p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">Conformance Checks</h2>
        {Object.values(component.checkResults).map((result) => (
          <CheckCard key={result.checkId} result={result} />
        ))}
      </main>
    </div>
  );
}