import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDraft, listAudits, AuditError } from "@/lib/audit/service";
import { resolveFile } from "@ds-validation/agent";
import { getFigmaToken } from "@/lib/figma-token";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audits = await listAudits(user.id);

  return NextResponse.json(
    audits.map((a) => ({
      id: a.id,
      fileKey: a.file_key,
      fileName: a.file_name,
      status: a.status,
      totalScore: a.total_score,
      createdAt: a.created_at,
      selectedPages: a.selected_pages,
    })),
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'url' field" },
      { status: 400 },
    );
  }

  try {
    const { accessToken } = await getFigmaToken(user.id);
    const { fileKey, fileName, pages } = await resolveFile(
      accessToken,
      url,
    );

    const audit = await createDraft(user.id, fileKey, fileName);

    return NextResponse.json({
      id: audit.id,
      fileKey: audit.file_key,
      fileName: audit.file_name,
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        componentCount: p.componentCount,
      })),
    });
  } catch (err) {
    if (err instanceof AuditError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }

    const message =
      err instanceof Error ? err.message : "Failed to create audit";

    if (message.includes("403") || message.includes("404")) {
      return NextResponse.json(
        { error: "Could not access the Figma file. Check your connection and permissions." },
        { status: 403 },
      );
    }

    if (message.includes("Could not parse")) {
      return NextResponse.json(
        { error: message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}