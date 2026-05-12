import { loadAuditData } from "@/lib/loadAuditData";
import { HeroSection } from "@/components/HeroSection";
import { ChecksRow } from "@/components/ChecksRow";
import { DashboardClient } from "@/components/DashboardClient";
import { CHECK_DEFS, statusForScore, gradeForScore } from "@/lib/utils";
import Link from "next/link";

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

  const componentBuckets = { pass: 0, partial: 0, fail: 0 };
  for (const c of audit.components) {
    componentBuckets[statusForScore(c.score)]++;
  }

  const byCheck = Object.fromEntries(
    CHECK_DEFS.map((d) => [d.id, { sum: 0, total: 0, pass: 0, partial: 0, fail: 0 }]),
  ) as Record<string, { sum: number; total: number; pass: number; partial: number; fail: number; avg: number }>;

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
    byCheck[k].avg = byCheck[k].sum / byCheck[k].total;
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
            {audit.totalScore}/100 &middot; {gradeForScore(audit.totalScore).label}
          </span>
          <span>
            file &middot; <span className="mono" style={{ color: "var(--text)" }}>{audit.meta.figmaFileKey.slice(0, 10)}</span>
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

