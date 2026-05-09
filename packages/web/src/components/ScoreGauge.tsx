import { statusForScore } from "../lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "lg";
}

export function ScoreGauge({ score, size = "lg" }: ScoreGaugeProps) {
  const gaugeSize = size === "lg" ? 96 : 64;
  const strokeWidth = size === "lg" ? 8 : 5;
  const r = (gaugeSize - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const status = statusForScore(score);
  const color = status === "pass" ? "var(--pass)" : status === "partial" ? "var(--partial)" : "var(--fail)";

  return (
    <div className="gauge" style={{ width: gaugeSize, height: gaugeSize }}>
      <svg width={gaugeSize} height={gaugeSize}>
        <circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={r}
          stroke="var(--bg-sunken)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="gauge-text">
        <div className="gauge-num" style={{ fontSize: size === "lg" ? 24 : 16 }}>
          {score}
        </div>
        <div className="gauge-label">SCORE</div>
      </div>
    </div>
  );
}
