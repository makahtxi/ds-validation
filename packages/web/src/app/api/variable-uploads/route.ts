import { NextResponse } from "next/server";
import { consumePairingCode } from "@/lib/audit/service";

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  let body: { code?: string; fileKey?: string; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.code || typeof body.code !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'code' field" },
      { status: 400 },
    );
  }

  if (!body.fileKey || typeof body.fileKey !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'fileKey' field" },
      { status: 400 },
    );
  }

  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json(
      { error: "Missing 'payload' field" },
      { status: 400 },
    );
  }

  const payloadSize = JSON.stringify(body.payload).length;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      { error: "Payload exceeds 5 MB limit" },
      { status: 413 },
    );
  }

  try {
    await consumePairingCode(
      body.code.toUpperCase().trim(),
      body.fileKey,
      body.payload as Record<string, unknown>,
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("Invalid pairing code") || message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("already used") || message.includes("expired")) {
      return NextResponse.json({ error: message }, { status: 410 });
    }
    if (message.includes("mismatch")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}