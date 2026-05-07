import { scoreColor } from "../lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "lg";
}

export function ScoreGauge({ score, size = "lg" }: ScoreGaugeProps) {
  const radius = size === "lg" ? 54 : 36;
  const strokeWidth = size === "lg" ? 8 : 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const dimension = size === "lg" ? 128 : 88;
  const fontSize = size === "lg" ? "text-3xl" : "text-xl";

  const strokeColor =
    score >= 80 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
        />
      </svg>
      <span
        className={`absolute ${fontSize} font-bold ${scoreColor(score)}`}
      >
        {score}
      </span>
    </div>
  );
}