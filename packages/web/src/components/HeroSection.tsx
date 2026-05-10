import { gradeForScore, statusForScore } from "@/lib/utils";

interface HeroSectionProps {
  audit: {
    meta: {
      figmaFileKey: string;
      figmaFileName: string;
      auditedAt: string;
      pagesAudited: string[];
      conformanceChecks: { id: string; name: string; weight: number }[];
    };
    totalScore: number;
    components: {
      name: string;
      score: number;
      passedChecks: number;
      totalChecks: number;
      pageName: string;
    }[];
  };
  aggregates: {
    componentBuckets: { pass: number; partial: number; fail: number };
  };
}

export function HeroSection({ audit, aggregates }: HeroSectionProps) {
  const grade = gradeForScore(audit.totalScore);
  const passCount = aggregates.componentBuckets.pass;
  const partialCount = aggregates.componentBuckets.partial;
  const failCount = aggregates.componentBuckets.fail;
  const total = audit.components.length;

  return (
    <div className="hero">
      <div className="hero-card">
        <div className="hero-eyebrow">{audit.meta.figmaFileName} System Health</div>
        <div className="hero-main">
          <div>
            <div className="hero-score">
              {audit.totalScore}
              <span className="pct">/ 100</span>
            </div>
            <div className={`hero-grade ${grade.cls}`}>
              <span
                className="dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "currentColor",
                  display: "inline-block",
                }}
              />
              {grade.label}
            </div>
          </div>
          <div className="hero-stats">
            <div className="row">
              <span className="k">Components</span>
              <span className="v">
                {total}
                <small> audited</small>
              </span>
            </div>
            <div className="row">
              <span className="k">Pages</span>
              <span className="v">
                {audit.meta.pagesAudited.length}
                <small> in library</small>
              </span>
            </div>
            <div className="row">
              <span className="k">Checks</span>
              <span className="v">
                {audit.meta.conformanceChecks.length}
                <small> per component</small>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-aside">
        <div className="hero-aside-card">
          <div className="label">Component Status</div>
          <div className="big mono">
            {passCount}
            <span style={{ color: "var(--text-faint)", fontSize: 18 }}> / {total}</span>
          </div>
          <div className="bar-stack">
            <div style={{ width: `${total ? (passCount / total) * 100 : 0}%`, background: "var(--pass)" }} />
            <div style={{ width: `${total ? (partialCount / total) * 100 : 0}%`, background: "var(--partial)" }} />
            <div style={{ width: `${total ? (failCount / total) * 100 : 0}%`, background: "var(--fail)" }} />
          </div>
          <div className="bar-legend">
            <span>
              <i className="swatch" style={{ background: "var(--pass)" }} />
              Pass {passCount}
            </span>
            <span>
              <i className="swatch" style={{ background: "var(--partial)" }} />
              Partial {partialCount}
            </span>
            <span>
              <i className="swatch" style={{ background: "var(--fail)" }} />
              Fail {failCount}
            </span>
          </div>
        </div>
        <div className="hero-aside-card">
          <div className="label">Audited</div>
          <div className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
            {new Date(audit.meta.auditedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
            file &middot; {audit.meta.figmaFileKey.slice(0, 12)}&hellip;
          </div>
        </div>
      </div>
    </div>
  );
}
