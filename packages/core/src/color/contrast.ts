import type { FigmaColor, FigmaPaint } from "../types/figma.js";

export function linearize(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: FigmaColor): number {
  const R = linearize(color.r);
  const G = linearize(color.g);
  const B = linearize(color.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(c1: FigmaColor, c2: FigmaColor): number {
  const L1 = relativeLuminance(c1);
  const L2 = relativeLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function blendColor(
  bg: FigmaColor,
  fg: FigmaColor,
  alpha: number,
): FigmaColor {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: fg.a * a + bg.a * (1 - a),
  };
}

export function colorToHex(color: FigmaColor): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function getSolidFillColor(paint: FigmaPaint): FigmaColor | null {
  if (paint.type !== "SOLID" || !paint.color) return null;
  if (paint.visible === false) return null;
  return paint.color;
}

