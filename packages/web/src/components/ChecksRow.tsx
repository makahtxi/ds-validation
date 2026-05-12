import { CHECK_DEFS, statusForScore } from "@/lib/utils";

interface ChecksRowProps {
  audit: {
    meta: {
      conformanceChecks: { id: string; name: string; weight: number }[];
    };
    components: {
      score: number;
      passedChecks: number;
      totalChecks: number;
    }[];
  };
  aggregates: {
    byCheck: Record<string, { sum: number; total: number; pass: number; partial: number; fail: number; avg: number }>;
  };
}

export function ChecksRow({ audit, aggregates }: ChecksRowProps) {
  return (
    <>
      <div className="section-h">
        <h2>Conformance Checks</h2>
        <span className="meta">{CHECK_DEFS.length} checks &middot; weighted average</span>
      </div>
      <div className="checks-row">
        {CHECK_DEFS.map((def) => {
          const agg = aggregates.byCheck[def.id];
          const pct = Math.round(agg.avg);
          const status = statusForScore(pct);
          return (
            <div key={def.id} className="check-card">
              {/* <div className="weight">w {def.weight.toFixed(2)}</div> */}
              <div>
                <div className="id">{def.short}</div>
                <div className="name">{def.name}</div>
              </div>
              <div className="num">
                {pct}
                <small>/100</small>
              </div>
              <div className="distrib-stack" title={`${agg.pass} pass &middot; ${agg.partial} partial &middot; ${agg.fail} fail`}>
                <div style={{ width: `${agg.total ? (agg.pass / agg.total) * 100 : 0}%`, background: "var(--pass)" }} />
                <div style={{ width: `${agg.total ? (agg.partial / agg.total) * 100 : 0}%`, background: "var(--partial)" }} />
                <div style={{ width: `${agg.total ? (agg.fail / agg.total) * 100 : 0}%`, background: "var(--fail)" }} />
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: "var(--text-faint)", display: "flex", justifyContent: "space-between" }}
              >
                <span>{agg.pass} pass</span>
                <span>{agg.partial} partial</span>
                <span>{agg.fail} fail</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
