import { after, NextResponse } from "next/server";
import { runAuditWorker } from "@/lib/audits/run";
import { getWorkerSecret } from "@/lib/audits/config";

export const runtime = "nodejs";
// Raised on Vercel Pro; the chunked runner re-fires itself if it needs longer.
export const maxDuration = 300;

/**
 * Internal background runner. Guarded by a shared secret (not a user session).
 * Responds 202 immediately and runs the audit via `after()` so the triggering
 * request returns fast while the work continues in this invocation.
 */
export async function POST(request: Request) {
  if (request.headers.get("x-worker-secret") !== getWorkerSecret()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { auditId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auditId = body.auditId;
  if (!auditId) {
    return NextResponse.json({ error: "auditId is required" }, { status: 400 });
  }

  after(async () => {
    await runAuditWorker(auditId);
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
