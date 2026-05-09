import { CHECK_DEFS, statusForScore } from "@/lib/utils";

interface CheckDotsProps {
  component: {
    score: number;
    passedChecks: number;
    totalChecks: number;
  };
}

export function CheckDots({ component }: CheckDotsProps) {
  const total = component.totalChecks || 5;
  const passed = component.passedChecks || 0;
  const fails = component.score < 50 ? 1 : 0;
  return (
    <span className="check-dots">
      {Array.from({ length: total }).map((_, i) => {
        let s: "pass" | "partial" | "fail" = "partial";
        if (i < passed) s = "pass";
        else if (i >= total - fails) s = "fail";
        return (
          <span
            key={i}
            className="d"
            data-s={s}
            title={CHECK_DEFS[i]?.short || ""}
          />
        );
      })}
    </span>
  );
}
