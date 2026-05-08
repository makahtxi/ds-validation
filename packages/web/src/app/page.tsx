import { loadAuditData } from "@/lib/loadAuditData";
import { ScoreGauge } from "@/components/ScoreGauge";
import { SummaryRenderer } from "@/components/SummaryRenderer";
import { ComponentGrid } from "@/components/ComponentGrid";

export default function HomePage() {
  const audit = loadAuditData();

  if (!audit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No Audit Data Found</h1>
          <p className="text-gray-600">
            Run <code className="bg-gray-100 px-2 py-1 rounded">ds-validation audit</code> first to generate results.
          </p>
        </div>
      </div>
    );
  }

  const groupedByPage = audit.components.reduce<Record<string, typeof audit.components>>(
    (acc, comp) => {
      const page = comp.pageName ?? "Unknown";
      if (!acc[page]) acc[page] = [];
      acc[page].push(comp);
      return acc;
    },
    {},
  );

  const pageOrder = audit.meta.pagesAudited.filter((page) => groupedByPage[page]?.length > 0);
  const unknownComponents = groupedByPage["Unknown"] ?? [];
  if (unknownComponents.length > 0) {
    pageOrder.push("Unknown");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">DS Validation</h1>
        <p className="text-gray-500 text-sm mt-1">
          {audit.meta.figmaFileName} — audited{" "}
          {new Date(audit.meta.auditedAt).toLocaleDateString()}
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-8 mb-8">
          <ScoreGauge score={audit.totalScore} />
          <div>
            <h2 className="text-xl font-semibold mb-1">Overall Score</h2>
            <SummaryRenderer entry={audit.summary} />
            <p className="text-gray-500 text-sm mt-2">
              {audit.components.length} component(s) audited across {pageOrder.length} page(s)
            </p>
          </div>
        </div>

        {pageOrder.map((pageName) => (
          <section key={pageName} className="mb-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {pageName}
              <span className="text-sm font-normal text-gray-400">
                ({groupedByPage[pageName].length})
              </span>
            </h2>
            <ComponentGrid components={groupedByPage[pageName]} />
          </section>
        ))}
      </main>
    </div>
  );
}
