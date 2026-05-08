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