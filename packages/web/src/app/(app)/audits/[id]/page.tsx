"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ComponentTable } from "@/components/ComponentTable";
import { MatrixSection } from "@/components/MatrixSection";
import { sanitizeComponentName } from "@ds-validation/core";

interface ComponentRow {
  component_name: string;
  page_name: string | null;
  score: number | null;
  result: Record<string, unknown>;
}

interface AuditDetail {
  id: string;
  fileKey: string;
  fileName: string | null;
  status: string;
  progress: { stage: string; current: number; total: number; message?: string } | null;
  totalScore: number | null;
  errorMessage: string | null;
  variableSource: string | null;
  selectedPages: string[] | null;
  createdAt: string;
  components: ComponentRow[];
}

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/audits/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Audit not found" : "Failed to load audit");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAudit(data);
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  // Poll while running or queued.
  useEffect(() => {
    if (!audit) return;
    if (audit.status !== "running" && audit.status !== "queued") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audits/${id}`);
        if (res.ok) {
          const data = await res.json();
          setAudit(data);
          if (data.status === "done" || data.status === "error") {
            clearInterval(interval);
          }
        }
      } catch {
        // keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [audit?.status, id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            {error ?? "Failed to load audit"}
          </h2>
          <button
            onClick={fetchAudit}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const fileName = audit.fileName ?? audit.fileKey;

  if (audit.status === "draft") {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{fileName}</h1>
        <p className="text-gray-500">This audit hasn&apos;t been started yet.</p>
        <button
          onClick={() => router.push("/audits/new")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Set up audit
        </button>
      </div>
    );
  }

  if (audit.status === "queued" || audit.status === "running") {
    const stage = audit.progress?.stage ?? "starting";
    const current = audit.progress?.current ?? 0;
    const total = audit.progress?.total ?? 1;
    const message = audit.progress?.message ?? "Processing…";
    const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{fileName}</h1>
        <p className="text-gray-500 mb-8">
          Audit is {audit.status === "queued" ? "queued" : "running"}…
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">{message}</span>
            <span className="text-gray-400">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">Stage: {stage}</div>
        </div>

        <button
          onClick={async () => {
            await fetch(`/api/audits/${id}/cancel`, { method: "POST" });
            fetchAudit();
          }}
          className="mt-4 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel audit
        </button>
      </div>
    );
  }

  if (audit.status === "error") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{fileName}</h1>
        <p className="text-red-600 mb-6">{audit.errorMessage ?? "Audit failed"}</p>

        <div className="flex gap-3">
          <button
            onClick={async () => {
              const res = await fetch(`/api/audits/${id}/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  selectedPages: audit.selectedPages ?? [],
                  variableSource: audit.variableSource ?? "skip",
                }),
              });
              if (res.ok) fetchAudit();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => router.push("/audits/new")}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            New audit
          </button>
        </div>
      </div>
    );
  }

  // status === "done"
  const componentsForMatrix = audit.components.map((c) => ({
    name: c.component_name,
    score: c.score ?? 0,
    passedChecks: Object.values(
      c.result as Record<string, { status: string }>,
    ).filter((r) => r.status === "pass").length,
    totalChecks: Object.keys(c.result).length,
    pageName: c.page_name ?? "",
    jsonPath: `components/${sanitizeComponentName(c.component_name)}.json`,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{fileName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {audit.selectedPages?.length ?? 0} page
            {audit.selectedPages?.length !== 1 ? "s" : ""} audited
            {audit.variableSource === "skip" && (
              <span className="ml-2 text-yellow-600">(variables skipped)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreGauge score={audit.totalScore ?? 0} />
          <button
            onClick={() => router.push("/audits/new")}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            New audit
          </button>
        </div>
      </div>

      <MatrixSection
        audit={{ components: componentsForMatrix }}
        onPick={(slug) => router.push(`/audits/${id}/components/${slug}`)}
      />

      <div className="mt-8">
        <ComponentTable
          audit={{ components: componentsForMatrix }}
          onPick={(slug) => router.push(`/audits/${id}/components/${slug}`)}
        />
      </div>
    </div>
  );
}
