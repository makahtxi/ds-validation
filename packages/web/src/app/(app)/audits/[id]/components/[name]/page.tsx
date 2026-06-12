"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ScoreGauge } from "@/components/ScoreGauge";
import { statusForScore, summaryText, CHECK_DEFS } from "@/lib/utils";
import { sanitizeComponentName } from "@ds-validation/core";
import Link from "next/link";

interface CheckResult {
  checkId: string;
  score: number;
  status: string;
  violations: Array<{
    nodePath: string;
    property: string;
    rawValue: string;
    expected: string;
    suggestedReplacement?: string;
  }>;
  summary: { template: string; params: Record<string, string | number> };
  notApplicable?: boolean;
}

interface ComponentDetail {
  id: string;
  fileKey: string;
  fileName: string;
  status: string;
  totalScore: number | null;
  components: Array<{
    component_name: string;
    page_name: string;
    score: number;
    result: Record<string, unknown>;
  }>;
}

export default function AuditComponentDetailPage() {
  const params = useParams<{ id: string; name: string }>();
  const { id, name } = params;

  const [audit, setAudit] = useState<ComponentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/audits/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAudit(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!audit || audit.status !== "done") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-gray-500">Audit results not available yet.</p>
        <Link href={`/audits/${id}`} className="text-blue-600 hover:underline mt-2 inline-block">
          &larr; Back to audit
        </Link>
      </div>
    );
  }

  const component = audit.components.find(
    (c) => sanitizeComponentName(c.component_name) === name,
  );

  if (!component) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-gray-500">Component &ldquo;{name}&rdquo; not found.</p>
        <Link href={`/audits/${id}`} className="text-blue-600 hover:underline mt-2 inline-block">
          &larr; Back to audit
        </Link>
      </div>
    );
  }

  const checkResults = Object.values(component.result as Record<string, unknown>) as unknown as CheckResult[];
  const status = statusForScore(component.score);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href={`/audits/${id}`} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        &larr; Back to audit
      </Link>

      <div className="mt-6 flex items-start gap-6">
        <ScoreGauge score={component.score} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{component.component_name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>{component.page_name}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              status === "pass" ? "bg-green-100 text-green-800" :
              status === "partial" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}>
              {status}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase">Score</div>
          <div className="text-2xl font-bold text-gray-900">{component.score}/100</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase">Checks</div>
          <div className="text-2xl font-bold text-gray-900">
            {checkResults.filter((r) => r.status === "pass").length}/{checkResults.length} passed
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase">Violations</div>
          <div className="text-2xl font-bold text-gray-900">
            {checkResults.reduce((a, r) => a + (r.violations?.length ?? 0), 0)}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conformance Checks</h2>
        <div className="space-y-3">
          {CHECK_DEFS.map((def) => {
            const result = component.result[def.id] as CheckResult | undefined;
            if (!result) {
              return (
                <div key={def.id} className="rounded-lg border border-gray-100 p-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-500">{def.name}</span>
                    <span className="text-gray-300">—</span>
                  </div>
                </div>
              );
            }
            const resultStatus = statusForScore(result.score);
            return (
              <div key={def.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-400">{def.short}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      resultStatus === "pass" ? "bg-green-100 text-green-800" :
                      resultStatus === "partial" ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {resultStatus}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{result.score}<small className="text-gray-400">/100</small></span>
                </div>
                <p className="text-sm text-gray-500">
                  {summaryText(result.summary, result.violations?.length ?? 0)}
                </p>
                {result.violations && result.violations.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                      {result.violations.length} violation{result.violations.length !== 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {result.violations.slice(0, 20).map((v, i) => (
                        <div key={i} className="text-xs font-mono text-gray-500 py-1 border-b border-gray-50">
                          <span className="text-gray-400">{v.nodePath}</span>{" "}
                          <span className="text-red-500">{v.property}</span>:{" "}
                          <span className="text-red-400">{v.rawValue}</span>{" "}
                          <span className="text-gray-300">&rarr;</span>{" "}
                          <span className="text-green-600">{v.expected}</span>
                        </div>
                      ))}
                      {result.violations.length > 20 && (
                        <p className="text-xs text-gray-400 mt-1">
                          +{result.violations.length - 20} more
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}