"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/ErrorState";

interface PageOption {
  id: string;
  name: string;
  componentCount: number;
}

type Step = "url" | "pages" | "variables" | "running" | "pairing" | "error";
type VariableSource = "rest-api" | "plugin" | "skip";

interface AuditProgress {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export function AuditWizard() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [auditId, setAuditId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  const [variableSource, setVariableSource] = useState<VariableSource | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResolveUrl = useCallback(async () => {
    setUrlError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUrlError(data.error ?? "Failed to resolve file");
        setLoading(false);
        return;
      }

      setAuditId(data.id);
      setFileName(data.fileName);
      setPages(data.pages ?? []);
      setSelectedPages(new Set(data.pages.map((p: PageOption) => p.name)));
      setStep("pages");
    } catch {
      setUrlError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleSelectPages = () => {
    if (selectedPages.size === 0) return;
    setStep("variables");
  };

  const handleStartAudit = useCallback(async () => {
    if (!auditId || !variableSource) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/audits/${auditId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNames: Array.from(selectedPages),
          variableSource,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Failed to start audit");
        setStep("error");
        setLoading(false);
        return;
      }

      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
        setStep("pairing");
        startPairingPoll();
      } else {
        setStep("running");
        startProgressPoll();
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }, [auditId, variableSource, selectedPages]);

  const startProgressPoll = useCallback(() => {
    if (!auditId) return;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/audits/${auditId}`);
        const data = await res.json();

        if (data.progress) {
          setProgress(data.progress);
        }

        if (data.status === "done") {
          if (pollRef.current) clearInterval(pollRef.current);
          router.push(`/audits/${auditId}`);
          return;
        }

        if (data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setErrorMessage(data.errorMessage ?? "Audit failed");
          setStep("error");
          return;
        }
      } catch {
        // Continue polling on network error
      }
    }, 2500);
  }, [auditId, router]);

  const startPairingPoll = useCallback(() => {
    if (!pairingCode || !auditId) return;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/variable-uploads/${pairingCode}`);
        const data = await res.json();

        if (data.consumed && data.hasVariables) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("running");
          startProgressPoll();
          return;
        }
      } catch {
        // Continue polling
      }
    }, 3000);
  }, [pairingCode, auditId, startProgressPoll]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const togglePage = (pageName: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageName)) {
        next.delete(pageName);
      } else {
        next.add(pageName);
      }
      return next;
    });
  };

  const handleCancel = async () => {
    if (!auditId) return;
    try {
      await fetch(`/api/audits/${auditId}/cancel`, { method: "POST" });
    } catch {
      // Best effort
    }
    if (pollRef.current) clearInterval(pollRef.current);
    router.push("/audits/new");
  };

  const handleRetry = async () => {
    if (!auditId) {
      setStep("url");
      return;
    }
    try {
      const res = await fetch(`/api/audits/${auditId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNames: Array.from(selectedPages),
          variableSource: variableSource ?? "skip",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStep("running");
        startProgressPoll();
      } else {
        setErrorMessage(data.error ?? "Retry failed");
      }
    } catch {
      setErrorMessage("Network error on retry");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">New Audit</h1>

      {step === "url" && (
        <StepUrl
          url={url}
          onUrlChange={setUrl}
          onSubmit={handleResolveUrl}
          loading={loading}
          error={urlError}
        />
      )}

      {step === "pages" && (
        <StepPages
          fileName={fileName}
          pages={pages}
          selectedPages={selectedPages}
          onToggle={togglePage}
          onContinue={handleSelectPages}
        />
      )}

      {step === "variables" && (
        <StepVariables
          fileName={fileName}
          selectedPages={selectedPages}
          variableSource={variableSource}
          onVariableSourceChange={setVariableSource}
          onStart={handleStartAudit}
          loading={loading}
        />
      )}

      {step === "pairing" && pairingCode && (
        <StepPairing
          pairingCode={pairingCode}
          onCancel={handleCancel}
        />
      )}

      {step === "running" && (
        <StepRunning
          progress={progress}
          onCancel={handleCancel}
        />
      )}

      {step === "error" && (
        <ErrorState
          title="Audit failed"
          message={errorMessage ?? "An unknown error occurred"}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}

function StepUrl({
  url,
  onUrlChange,
  onSubmit,
  loading,
  error,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Enter Figma file URL
        </h2>
        <p className="text-sm text-gray-500">
          Paste the link to a Figma design file. We&apos;ll fetch its structure
          so you can choose which pages to audit.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <Input
          label="Figma URL"
          placeholder="https://www.figma.com/design/abc123/..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          error={error ?? undefined}
          disabled={loading}
          autoComplete="off"
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={!url.trim() || loading}>
            {loading ? "Resolving..." : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StepPages({
  fileName,
  pages,
  selectedPages,
  onToggle,
  onContinue,
}: {
  fileName: string;
  pages: PageOption[];
  selectedPages: Set<string>;
  onToggle: (name: string) => void;
  onContinue: () => void;
}) {
  const allSelected = pages.length === selectedPages.size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {fileName}
        </h2>
        <p className="text-sm text-gray-500">
          Select the pages you want to audit.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        <button
          onClick={() => {
            if (allSelected) {
              selectedPages.forEach((name) => onToggle(name));
            } else {
              pages.forEach((p) => {
                if (!selectedPages.has(p.name)) onToggle(p.name);
              });
            }
          }}
          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              allSelected
                ? "bg-blue-600 border-blue-600"
                : "border-gray-300"
            }`}
          >
            {allSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">Select all</span>
        </button>

        {pages.map((page) => {
          const checked = selectedPages.has(page.name);
          return (
            <button
              key={page.id}
              onClick={() => onToggle(page.name)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                  checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                }`}
              >
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-900">{page.name}</span>
              {page.componentCount > 0 && (
                <span className="text-xs text-gray-400 ml-auto">
                  {page.componentCount} component{page.componentCount !== 1 ? "s" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={selectedPages.size === 0} onClick={onContinue}>
          Continue ({selectedPages.size} page{selectedPages.size !== 1 ? "s" : ""})
        </Button>
        <span className="text-xs text-gray-400">
          {selectedPages.size} of {pages.length} selected
        </span>
      </div>
    </div>
  );
}

function StepVariables({
  fileName,
  selectedPages,
  variableSource,
  onVariableSourceChange,
  onStart,
  loading,
}: {
  fileName: string;
  selectedPages: Set<string>;
  variableSource: VariableSource | null;
  onVariableSourceChange: (s: VariableSource) => void;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Variable source
        </h2>
        <p className="text-sm text-gray-500">
          {fileName} — {selectedPages.size} page{selectedPages.size !== 1 ? "s" : ""}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Choose how to provide design variables for the audit.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onVariableSourceChange("rest-api")}
          className={`w-full rounded-xl border p-4 text-left transition-colors ${
            variableSource === "rest-api"
              ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
              : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              variableSource === "rest-api" ? "border-blue-600" : "border-gray-300"
            }`}>
              {variableSource === "rest-api" && (
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">REST API</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Fetch variables directly from Figma. Requires Enterprise plan access.
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => onVariableSourceChange("plugin")}
          className={`w-full rounded-xl border p-4 text-left transition-colors ${
            variableSource === "plugin"
              ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
              : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              variableSource === "plugin" ? "border-blue-600" : "border-gray-300"
            }`}>
              {variableSource === "plugin" && (
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">Figma Plugin</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Use the DS Validation plugin in Figma to send variables securely.
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => onVariableSourceChange("skip")}
          className={`w-full rounded-xl border p-4 text-left transition-colors ${
            variableSource === "skip"
              ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
              : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              variableSource === "skip" ? "border-blue-600" : "border-gray-300"
            }`}>
              {variableSource === "skip" && (
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">Skip variables</div>
              <div className="text-xs text-gray-500 mt-0.5">
                The &quot;no-primitive-tokens&quot; check will be disabled. Your total
                score will reflect this gap.
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-3">
        <Button disabled={!variableSource || loading} onClick={onStart}>
          {loading ? "Starting..." : "Start audit"}
        </Button>
      </div>
    </div>
  );
}

function StepPairing({
  pairingCode,
  onCancel,
}: {
  pairingCode: string;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Connect the Figma plugin
        </h2>
        <p className="text-sm text-gray-500">
          Open the DS Validation plugin in your Figma file and enter this code:
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-8 text-center">
        <div className="text-3xl font-mono font-bold tracking-[0.3em] text-blue-700">
          {pairingCode}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="font-medium text-gray-900">Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>Open your Figma file</li>
          <li>Go to <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono">Plugins → DS Validation</kbd></li>
          <li>Switch to the <strong>Hosted</strong> tab</li>
          <li>Enter the code above and select your design system file</li>
          <li>Click <strong>Send</strong></li>
        </ol>
        <p className="text-xs text-gray-400 mt-2">
          This page will update automatically when the variables are received.
          The code expires in 10 minutes.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Waiting for plugin data...
      </div>

      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function StepRunning({
  progress,
  onCancel,
}: {
  progress: AuditProgress | null;
  onCancel: () => void;
}) {
  const stage = progress?.stage ?? "starting";
  const current = progress?.current ?? 0;
  const total = progress?.total ?? 1;
  const message = progress?.message ?? "Initializing...";

  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Running audit
        </h2>
        <p className="text-sm text-gray-500">
          This may take a few minutes depending on file size.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900">{message}</span>
          <span className="text-gray-400">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-gray-400">
          Stage: {stage}
        </div>
      </div>

      <Button variant="secondary" onClick={onCancel}>
        Cancel audit
      </Button>
    </div>
  );
}