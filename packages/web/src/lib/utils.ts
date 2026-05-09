export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-100 border-green-300";
  if (score >= 50) return "bg-yellow-100 border-yellow-300";
  return "bg-red-100 border-red-300";
}

export function statusBadge(status: string): string {
  switch (status) {
    case "pass":
      return "bg-green-200 text-green-800";
    case "partial":
      return "bg-yellow-200 text-yellow-800";
    case "fail":
      return "bg-red-200 text-red-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function statusForScore(score: number): "pass" | "partial" | "fail" {
  if (score >= 80) return "pass";
  if (score >= 50) return "partial";
  return "fail";
}

export function bucketForScore(score: number): number {
  if (score >= 90) return 4;
  if (score >= 80) return 3;
  if (score >= 70) return 2;
  if (score >= 55) return 1;
  return 0;
}

export function gradeForScore(score: number): { label: string; cls: string } {
  if (score >= 90) return { label: "Excellent", cls: "" };
  if (score >= 80) return { label: "Healthy", cls: "" };
  if (score >= 65) return { label: "Needs Attention", cls: "partial" };
  if (score >= 50) return { label: "At Risk", cls: "partial" };
  return { label: "Critical", cls: "fail" };
}

export function summaryText(
  summary: { template: string; params: Record<string, string | number> } | undefined,
  count: number,
): string {
  const t = summary?.template || "";
  const p = summary?.params || {};
  const map: Record<string, string> = {
    hardcoded_colors_clean: "No hard-coded colors detected",
    hardcoded_colors_found: `${p.count ?? count ?? "?"} hard-coded color${(p.count ?? count) === 1 ? "" : "s"}`,
    hardcoded_spacing_clean: "No hard-coded spacing detected",
    hardcoded_spacing_found: `${p.count ?? count ?? "?"} hard-coded spacing value${(p.count ?? count) === 1 ? "" : "s"}`,
    hardcoded_text_styles_clean: "No hard-coded text styles",
    hardcoded_text_styles_found: `${p.count ?? count ?? "?"} hard-coded text styles`,
    primitive_tokens_clean: "All references use semantic tokens",
    primitive_tokens_found: `${p.count ?? count ?? "?"} primitive token reference${(p.count ?? count) === 1 ? "" : "s"}`,
    state_variables_complete: "All 5 states defined",
    state_variables_partial: `${p.found ?? "?"}/${p.total ?? 5} states defined`,
  };
  return map[t] || t;
}

export const CHECK_DEFS = [
  { id: "hardcoded-colors", short: "Colors", name: "No Hard-Coded Colors", weight: 0.25 },
  { id: "hardcoded-spacing", short: "Spacing", name: "No Hard-Coded Spacing", weight: 0.15 },
  { id: "hardcoded-text-styles", short: "Typography", name: "No Hard-Coded Text Styles", weight: 0.2 },
  { id: "no-primitive-tokens", short: "Tokens", name: "Correct Token Usage", weight: 0.25 },
  { id: "state-variables", short: "States", name: "State Variables Available", weight: 0.15 },
] as const;
