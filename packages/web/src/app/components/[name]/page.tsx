import { loadAuditData, loadComponentData } from "@/lib/loadAuditData";
import { ScoreGauge } from "@/components/ScoreGauge";
import { summaryText, statusForScore, CHECK_DEFS } from "@/lib/utils";
import Link from "next/link";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function ComponentDetailPage({ params }: PageProps) {
  const { name } = await params;
  const component = loadComponentData(name);
  const audit = loadAuditData();

  if (!component) {
    return (
      <div className="shell">
        <div className="page">
          <div className="empty">
            <div className="e-mark">?</div>
            <div>Component &ldquo;{name}&rdquo; not found.</div>
            <Link href="/" className="detail-back" style={{ marginTop: 16, display: "inline-flex" }}>
              &larr; Back to overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const checkResults = Object.values(component.checkResults);

  return (
    <div className="shell">
      <div className="topbar">
        <Link className="logo" href="/">
          <span className="logo-mark" />
          <span>
            DS<span style={{ color: "var(--text-faint)" }}>&middot;</span>
            <span style={{ color: "var(--text-muted)" }}>Validation</span>
          </span>
        </Link>
        <div className="crumbs">
          <span className="sep">/</span>
          <Link href="/">{audit?.meta.figmaFileName || "Overview"}</Link>
          <span className="sep">/</span>
          <span style={{ color: "var(--text)" }}>{component.componentName}</span>
        </div>
        <div className="spacer" />
        <div className="meta">
          <span className="pill">
            <span className="dot" />
            {component.score}/100
          </span>
        </div>
      </div>

      <div className="page">
        <Link href="/" className="detail-back">
          &larr; Back to overview
        </Link>

        <div className="detail-header">
          <ScoreGauge score={component.score} size="lg" />
          <div>
            <h1>{component.componentName}</h1>
            <div className="sub">
              <span>{component.pageName}</span>
              <span className="kbd">{statusForScore(component.score)}</span>
            </div>
          </div>
          <div className="detail-meta">
            <div>
              <div className="k">Score</div>
              <div className="v">{component.score}/100</div>
            </div>
            <div>
              <div className="k">Checks</div>
              <div className="v">
                {checkResults.filter((r) => r.status === "pass").length}/{checkResults.length} passed
              </div>
            </div>
            <div>
              <div className="k">Violations</div>
              <div className="v">{checkResults.reduce((a, r) => a + r.violations.length, 0)}</div>
            </div>
          </div>
        </div>

        <div className="section-h">
          <h2>Conformance Checks</h2>
        </div>
        <div className="detail-checks">
          {CHECK_DEFS.map((def) => {
            const result = component.checkResults[def.id];
            if (!result) {
              return (
                <div key={def.id} className="detail-check disabled">
                  <div className="top">
                    <span className="check-id">{def.short}</span>
                    <span
                      style={{
                        position: "static",
                        background: "var(--bg-chip)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--text-faint)",
                      }}
                    >
                      w {def.weight.toFixed(2)}
                    </span>
                  </div>
                  <div className="check-name">{def.name}</div>
                  <div className="check-score" style={{ color: "var(--text-faint)" }}>
                    &mdash;
                  </div>
                  <div className="summary">No data</div>
                </div>
              );
            }
            const status = result.status;
            return (
              <div key={def.id} className="detail-check">
                <div className="top">
                  <span className="check-id">{def.short}</span>
                  <span
                    className={`badge ${status}`}
                    style={{
                      display: "inline-flex",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      background:
                        status === "pass"
                          ? "var(--pass-soft)"
                          : status === "partial"
                            ? "var(--partial-soft)"
                            : "var(--fail-soft)",
                      color:
                        status === "pass"
                          ? "var(--pass)"
                          : status === "partial"
                            ? "oklch(0.45 0.14 75)"
                            : "var(--fail)",
                    }}
                  >
                    {status}
                  </span>
                </div>
                <div className="check-name">{def.name}</div>
                <div className="check-score">
                  {result.score}
                  <small>/100</small>
                </div>
                <div className="summary">{summaryText(result.summary, result.violations.length)}</div>
              </div>
            );
          })}
        </div>

        {checkResults
          .filter((r) => r.violations.length > 0)
          .map((result) => (
            <div key={result.checkId} className="issues" style={{ marginBottom: 16 }}>
              <div className="issues-header">
                <div>
                  <h3>
                    {CHECK_DEFS.find((d) => d.id === result.checkId)?.name || result.checkId}
                    <span className="count">
                      {result.violations.length} {result.violations.length === 1 ? "issue" : "issues"}
                    </span>
                  </h3>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {summaryText(result.summary, result.violations.length)}
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                  score &middot; {result.score}/100
                </div>
              </div>
              {result.violations.map((v, i) => (
                <div key={i} className="issue">
                  <div className="num">{String(i + 1).padStart(2, "0")}</div>
                  <div className="body">
                    <div className="path mono">
                      {v.nodePath.split(" > ").map((s, j, arr) => (
                        <span key={j}>
                          {j > 0 && <span className="seg-bullet">&rsaquo;</span>}
                          <span style={{ color: j === arr.length - 1 ? "var(--text)" : "var(--text-muted)" }}>
                            {s}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="row">
                      <span className="k">Property</span>
                      <span className="v">{v.property}</span>
                      <span className="k" style={{ marginLeft: 8 }}>Found</span>
                      <span className="v bad">{v.rawValue}</span>
                      <span className="arrow">&rarr;</span>
                      <span className="k">Expected</span>
                      <span className="v good">{v.expected}</span>
                      {v.suggestedReplacement && (
                        <>
                          <span className="arrow">&rarr;</span>
                          <span className="k">Suggestion</span>
                          <span className="v good">{v.suggestedReplacement}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {checkResults.every((r) => r.violations.length === 0) && (
          <div className="issues">
            <div className="empty">
              <div className="e-mark">&radic;</div>
              <div>No issues found. All checks passed.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
