import type { CheckResult, CheckStatus } from "../types/checks.js";

export function computeCheckScore(
  violationCount: number,
  totalOpportunities: number,
): number {
  if (totalOpportunities === 0) return 100;
  return Math.round((1 - violationCount / totalOpportunities) * 100);
}

export function computeComponentScore(
  checkResults: Record<string, CheckResult>,
  weights: Record<string, number>,
): number {
  const entries = Object.entries(checkResults);
  if (entries.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [checkId, result] of entries) {
    const weight = weights[checkId] ?? 0;
    weightedSum += result.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

export function computeTotalScore(componentScores: number[]): number {
  if (componentScores.length === 0) return 0;
  const sum = componentScores.reduce((acc, s) => acc + s, 0);
  return Math.round(sum / componentScores.length);
}

export function determineStatus(score: number): CheckStatus {
  if (score === 100) return "pass";
  if (score >= 50) return "partial";
  return "fail";
}