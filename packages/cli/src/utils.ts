export function parseFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (match) return match[1];

  if (/^[a-zA-Z0-9]+$/.test(url)) return url;

  return null;
}