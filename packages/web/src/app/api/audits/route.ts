import { NextResponse } from "next/server";
import { resolveFile } from "@ds-validation/agent";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFigmaToken } from "@/lib/figma-token";

export const runtime = "nodejs";

/**
 * Create a draft audit. Parses the Figma URL, resolves the file's name + page
 * list (fast, depth=1), and stores a `draft` row. Access / token / bad-URL
 * errors surface immediately.
 */
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

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "A Figma URL is required" }, { status: 400 });
  }

  let token: { accessToken: string; kind: "pat" | "oauth" };
  try {
    token = await getFigmaToken(user.id);
  } catch {
    return NextResponse.json(
      { error: "Connect Figma before starting an audit." },
      { status: 400 },
    );
  }

  let resolved;
  try {
    resolved = await resolveFile(token.accessToken, url, token.kind);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not resolve the Figma file";
    // Parse failures are the user's input; access/404 from Figma are 422.
    const status = /parse Figma file key/i.test(message) ? 400 : 422;
    return NextResponse.json({ error: friendlyFigmaError(message) }, { status });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("audits")
    .insert({
      user_id: user.id,
      file_key: resolved.fileKey,
      file_name: resolved.fileName,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create audit" }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    fileKey: resolved.fileKey,
    fileName: resolved.fileName,
    pages: resolved.pages,
  });
}

function friendlyFigmaError(message: string): string {
  if (/parse Figma file key/i.test(message)) {
    return "That doesn't look like a Figma file URL.";
  }
  if (/40[34]/.test(message)) {
    return "We couldn't open that file — check the link and that your Figma account has access.";
  }
  return message;
}
