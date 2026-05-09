import { statusForScore } from "@/lib/utils";

interface ScoreBarProps {
  score: number;
  width?: number;
}

export function ScoreBar({ score, width = 80 }: ScoreBarProps) {
  const status = statusForScore(score);
  const color = status === "pass" ? "var(--pass)" : status === "partial" ? "var(--partial)" : "var(--fail)";
  return (
    <span className="score-bar-mini" style={{ width }}>
      <i style={{ width: `${score}%`, background: color }} />
    </span>
  );
}
