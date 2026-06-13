"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";

interface ConnectionState {
  connected: boolean;
  kind?: "oauth" | "pat";
  figmaUserHandle?: string;
  figmaUserImgUrl?: string;
  grantedScopes?: string[];
}

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-40" />
          </div>
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [status, setStatus] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patValue, setPatValue] = useState("");
  const [patSaving, setPatSaving] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/figma/connection");
      if (!res.ok) throw new Error("Failed to fetch connection status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      const messages: Record<string, string> = {
        missing_params: "OAuth flow was interrupted. Please try again.",
        invalid_state: "Security check failed. Please try again.",
        token_exchange_failed: "Failed to exchange OAuth code with Figma.",
        connection_failed: "Failed to verify Figma connection.",
      };
      toast(messages[err] ?? "An error occurred", "error");
    }
  }, [searchParams, toast]);

  async function handlePatSave(e: React.FormEvent) {
    e.preventDefault();
    if (!patValue.trim()) return;

    setPatSaving(true);
    setPatError(null);

    try {
      const res = await fetch("/api/figma/pat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: patValue.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPatError(data.error ?? "Failed to save token");
        return;
      }

      setPatValue("");
      setStatus(data);
      toast("Figma connected successfully", "success");
    } catch {
      setPatError("Network error. Please try again.");
    } finally {
      setPatSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/figma/connection", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setStatus({ connected: false });
      toast("Figma disconnected", "info");
    } catch {
      toast("Failed to disconnect", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <ErrorState
          title="Failed to load connections"
          message={error}
          onRetry={fetchStatus}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Figma Connections
      </h1>

      {status?.connected ? (
        <ConnectedState
          status={status}
          onDisconnect={handleDisconnect}
          isDisconnecting={disconnecting}
        />
      ) : (
        <NotConnectedState
          patValue={patValue}
          onPatChange={setPatValue}
          onPatSave={handlePatSave}
          patSaving={patSaving}
          patError={patError}
        />
      )}
    </div>
  );
}

function ConnectedState({
  status,
  onDisconnect,
  isDisconnecting,
}: {
  status: ConnectionState;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) {
  const kindLabel = status.kind === "oauth" ? "OAuth" : "Personal Access Token";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Connected via {kindLabel}
          </h2>
          {status.figmaUserHandle && (
            <p className="text-sm text-gray-500">
              Signed in as{" "}
              <span className="font-medium text-gray-700">
                {status.figmaUserHandle}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
        Tokens stored encrypted. Not readable by the client.
      </div>

      {(status.grantedScopes ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {status.grantedScopes!.map((scope) => (
            <span
              key={scope}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
            >
              {scope}
            </span>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDisconnect}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? "Disconnecting..." : "Disconnect"}
        </Button>
      </div>
    </div>
  );
}

function NotConnectedState({
  patValue,
  onPatChange,
  onPatSave,
  patSaving,
  patError,
}: {
  patValue: string;
  onPatChange: (v: string) => void;
  onPatSave: (e: React.FormEvent) => void;
  patSaving: boolean;
  patError: string | null;
}) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Connect with Figma OAuth
            </h2>
            <p className="text-sm text-gray-500">
              Recommended. Grants read-only access to your files. Tokens refresh
              automatically.
            </p>
          </div>
        </div>
        <a href="/api/figma/connect">
          <Button variant="primary">Connect Figma</Button>
        </a>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-gray-50 px-3 text-gray-400">
            or use a personal access token
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Personal Access Token
          </h2>
          <p className="text-sm text-gray-500">
            Generate one at{" "}
            <a
              href="https://www.figma.com/developers/api#access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
            >
              Figma account settings
            </a>
            . Tokens don&apos;t expire.
          </p>
        </div>

        <form onSubmit={onPatSave} className="space-y-3">
          <Input
            type="password"
            label="Personal access token"
            placeholder="figd_..."
            value={patValue}
            onChange={(e) => onPatChange(e.target.value)}
            error={patError ?? undefined}
            disabled={patSaving}
            autoComplete="off"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!patValue.trim() || patSaving}>
              {patSaving ? "Verifying..." : "Save token"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
