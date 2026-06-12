import { loadAuditData } from "@/lib/loadAuditData";
import { HeroSection } from "@/components/HeroSection";
import { ChecksRow } from "@/components/ChecksRow";
import { DashboardClient } from "@/components/DashboardClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { CHECK_DEFS, statusForScore, gradeForScore } from "@/lib/utils";
import Link from "next/link";

export function AppDashboard() {
  const audit = loadAuditData();

  if (!audit) {
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
          <div className="spacer" />
        </div>
        <div className="page">
          <EmptyState
            title="No audit data yet"
            description="Run your first audit to see results here."
            action={
              <Link
                href="/audits/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                New Audit
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const componentBuckets = { pass: 0, partial: 0, fail: 0 };
  for (const c of audit.components) {
    componentBuckets[statusForScore(c.score)]++;
  }

  const byCheck = Object.fromEntries(
    CHECK_DEFS.map((d) => [
      d.id,
      {
        sum: 0,
        total: 0,
        pass: 0,
        partial: 0,
        fail: 0,
        avg: 0,
      },
    ]),
  ) as Record<
    string,
    {
      sum: number;
      total: number;
      pass: number;
      partial: number;
      fail: number;
      avg: number;
    }
  >;

  for (const c of audit.components) {
    const passed = c.passedChecks || 0;
    const total = c.totalChecks || CHECK_DEFS.length;
    const fails = c.score < 50 ? 1 : 0;
    CHECK_DEFS.forEach((d, i) => {
      const bucket = byCheck[d.id];
      bucket.total++;
      let s: "pass" | "partial" | "fail";
      if (i < passed) s = "pass";
      else if (i >= total - fails) s = "fail";
      else s = "partial";
      bucket[s]++;
      bucket.sum += s === "pass" ? 100 : s === "fail" ? 25 : 70;
    });
  }
  for (const k of Object.keys(byCheck)) {
    byCheck[k].avg = byCheck[k].total > 0 ? byCheck[k].sum / byCheck[k].total : 0;
  }

  const aggregates = { byCheck, componentBuckets };

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
          <Link href="/">{audit.meta.figmaFileName}</Link>
        </div>
        <div className="spacer" />
        <div className="meta">
          <span className="pill">
            <span className="dot" />
            {audit.totalScore}/100 &middot;{" "}
            {gradeForScore(audit.totalScore).label}
          </span>
          <span>
            file &middot;{" "}
            <span className="mono" style={{ color: "var(--text)" }}>
              {audit.meta.figmaFileKey.slice(0, 10)}
            </span>
          </span>
        </div>
      </div>

      <div className="page">
        <HeroSection audit={audit} aggregates={aggregates} />
        <ChecksRow audit={audit} aggregates={aggregates} />
        <DashboardClient audit={audit} />
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "40px 20px 20px",
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--text-faint)",
        }}
      >
        DS Validation &mdash; design system conformance audit
      </div>
    </div>
  );
}
