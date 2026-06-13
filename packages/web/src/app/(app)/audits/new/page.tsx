"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";

interface PageSummary {
  id: string;
  name: string;
  componentCount: number;
}

interface Draft {
  id: string;
  fileKey: string;
  fileName: string;
  pages: PageSummary[];
}

type VariableSource = "rest" | "plugin" | "skip";

interface AuditStatus {
  status: "draft" | "queued" | "running" | "done" | "error";
  progress: { stage?: string; current?: number; total?: number };
  errorMessage: string | null;
  variableUploadReceived: boolean;
}

export default function NewAuditPage() {
  const [step, setStep] = useState<"url" | "setup" | "running">("url");
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">New Audit</h1>
      <p className="text-gray-500 mb-8">
        Paste a Figma file link, pick pages and a variable source, then watch it
        run.
      </p>

      {step === "url" && (
        <UrlStep
          onDraft={(d) => {
            setDraft(d);
            setStep("setup");
          }}
        />
      )}
      {step === "setup" && draft && (
        <SetupStep draft={draft} onStarted={() => setStep("running")} />
      )}
      {step === "running" && draft && (
        <RunningStep auditId={draft.id} onRetry={() => setStep("setup")} />
      )}
    </div>
  );
}

function UrlStep({ onDraft }: { onDraft: (d: Draft) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to resolve the file");
        return;
      }
      onDraft(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-6 space-y-4"
    >
      <Input
        label="Figma file URL"
        placeholder="https://www.figma.com/design/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        error={error ?? undefined}
        disabled={loading}
        autoFocus
      />
      <Button type="submit" disabled={!url.trim() || loading}>
        {loading ? "Resolving…" : "Continue"}
      </Button>
    </form>
  );
}

function SetupStep({
  draft,
  onStarted,
}: {
  draft: Draft;
  onStarted: () => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(draft.pages.map((p) => p.name)),
  );
  const [source, setSource] = useState<VariableSource | null>(null);
  const [restAvailable, setRestAvailable] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pairing (plugin) state.
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [uploadReceived, setUploadReceived] = useState(false);

  // Probe REST variables availability once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/audits/${draft.id}/variable-sources`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRestAvailable(Boolean(d.rest));
      })
      .catch(() => {
        if (!cancelled) setRestAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id]);

  // While waiting for the plugin upload, poll the audit for delivery.
  useEffect(() => {
    if (source !== "plugin" || !pairingCode || uploadReceived) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audits/${draft.id}`);
        if (!res.ok) return;
        const data: AuditStatus = await res.json();
        if (data.variableUploadReceived) {
          setUploadReceived(true);
          toast("Variables received from the plugin", "success");
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [source, pairingCode, uploadReceived, draft.id, toast]);

  function togglePage(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function requestPairingCode() {
    setError(null);
    try {
      const res = await fetch(`/api/audits/${draft.id}/pairing-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create a pairing code");
        return;
      }
      setPairingCode(data.code);
      setUploadReceived(false);
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const canStart =
    selected.size > 0 &&
    source !== null &&
    (source !== "plugin" || uploadReceived) &&
    !starting;

  async function handleStart() {
    if (!source) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/audits/${draft.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPages: Array.from(selected),
          variableSource: source,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start the audit");
        return;
      }
      onStarted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500">
        Auditing <span className="font-medium text-gray-700">{draft.fileName}</span>
      </p>

      {/* Pages */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pages</h2>
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-700"
            onClick={() =>
              setSelected((prev) =>
                prev.size === draft.pages.length
                  ? new Set()
                  : new Set(draft.pages.map((p) => p.name)),
              )
            }
          >
            {selected.size === draft.pages.length ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {draft.pages.map((page) => (
            <label
              key={page.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(page.name)}
                onChange={() => togglePage(page.name)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-800 truncate">{page.name}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Variable source */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Variable source</h2>
        <p className="text-sm text-gray-500">
          Where should we read your design tokens from? This powers the
          primitive-token check.
        </p>

        <div className="space-y-2">
          <SourceOption
            label="Figma REST API"
            description={
              restAvailable === null
                ? "Checking availability…"
                : restAvailable
                  ? "Reads variables directly. Fastest."
                  : "Not available — variables REST access is Enterprise-only."
            }
            value="rest"
            current={source}
            disabled={restAvailable !== true}
            onSelect={setSource}
          />
          <SourceOption
            label="Figma plugin"
            description="Send variables from the DS Validation plugin using a pairing code."
            value="plugin"
            current={source}
            onSelect={setSource}
          />
          <SourceOption
            label="Skip"
            description="Audit without variables. The primitive-token check is disabled and labeled in the report."
            value="skip"
            current={source}
            onSelect={setSource}
          />
        </div>

        {source === "plugin" && (
          <PluginPairing
            code={pairingCode}
            received={uploadReceived}
            onRequestCode={requestPairingCode}
          />
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleStart} disabled={!canStart}>
          {starting ? "Starting…" : "Start audit"}
        </Button>
        {selected.size === 0 && (
          <span className="text-sm text-gray-400">Select at least one page</span>
        )}
      </div>
    </div>
  );
}

function SourceOption({
  label,
  description,
  value,
  current,
  disabled,
  onSelect,
}: {
  label: string;
  description: string;
  value: VariableSource;
  current: VariableSource | null;
  disabled?: boolean;
  onSelect: (v: VariableSource) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
        active
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      } ${disabled ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-4 w-4 rounded-full border ${
            active ? "border-blue-500 bg-blue-500" : "border-gray-300"
          }`}
        />
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
      <p className="text-sm text-gray-500 mt-1 ml-6">{description}</p>
    </button>
  );
}

function PluginPairing({
  code,
  received,
  onRequestCode,
}: {
  code: string | null;
  received: boolean;
  onRequestCode: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      {!code ? (
        <Button variant="secondary" size="sm" onClick={onRequestCode}>
          Get pairing code
        </Button>
      ) : received ? (
        <p className="text-sm font-medium text-green-700">
          ✓ Variables received — you can start the audit.
        </p>
      ) : (
        <div className="space-y-2">
          <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
            <li>Open the DS Validation plugin in this Figma file.</li>
            <li>Enter the pairing code below and send.</li>
          </ol>
          <div className="font-mono text-2xl tracking-[0.3em] text-gray-900">
            {code}
          </div>
          <p className="text-xs text-gray-400">
            Waiting for the plugin… this panel updates automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function RunningStep({
  auditId,
  onRetry,
}: {
  auditId: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const redirected = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/audits/${auditId}`);
      if (!res.ok) return;
      const data: AuditStatus = await res.json();
      setStatus(data);
      if (data.status === "done" && !redirected.current) {
        redirected.current = true;
        router.push(`/audits/${auditId}`);
      }
    } catch {
      /* keep polling */
    }
  }, [auditId, router]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [poll]);

  if (status?.status === "error") {
    return (
      <ErrorState
        title="Audit failed"
        message={status.errorMessage ?? "The audit ended in an error."}
        onRetry={onRetry}
      />
    );
  }

  const progress = status?.progress ?? {};
  const total = progress.total ?? 0;
  const current = progress.current ?? 0;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <h2 className="text-lg font-semibold text-gray-900">
          {stageLabel(status?.status, progress.stage)}
        </h2>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {total > 0 && (
        <p className="text-sm text-gray-500">
          {current} of {total}
        </p>
      )}
    </div>
  );
}

function stageLabel(status?: string, stage?: string): string {
  if (status === "queued") return "Queued…";
  if (status === "done") return "Done — opening report…";
  switch (stage) {
    case "fetching-nodes":
      return "Fetching components from Figma…";
    case "auditing":
      return "Auditing components…";
    case "done":
      return "Done — opening report…";
    default:
      return "Starting…";
  }
}
