interface CheckCardProps {
  result: {
    checkId: string;
    score: number;
    status: string;
    violations: {
      nodePath: string;
      property: string;
      rawValue: string;
      expected: string;
      suggestedReplacement?: string;
    }[];
    summary: { template: string; params: Record<string, string | number> };
  };
}

import { ScoreGauge } from "./ScoreGauge";
import { SummaryRenderer } from "./SummaryRenderer";
import { statusBadge, scoreColor } from "../lib/utils";

export function CheckCard({ result }: CheckCardProps) {
  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">{result.checkId}</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${statusBadge(result.status)}`}
        >
          {result.status}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <ScoreGauge score={result.score} size="sm" />
        <span className={`text-2xl font-bold ${scoreColor(result.score)}`}>
          {result.score}/100
        </span>
      </div>

      <SummaryRenderer entry={result.summary} />

      {result.violations.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-600">
            {result.violations.length} violation(s)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-4">Node</th>
                  <th className="py-1 pr-4">Property</th>
                  <th className="py-1 pr-4">Raw Value</th>
                  <th className="py-1 pr-4">Expected</th>
                  <th className="py-1">Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {result.violations.map((v, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 pr-4 font-mono text-xs">{v.nodePath}</td>
                    <td className="py-1 pr-4 font-mono text-xs">{v.property}</td>
                    <td className="py-1 pr-4 text-red-600 font-mono text-xs">
                      {v.rawValue}
                    </td>
                    <td className="py-1 pr-4 text-xs">{v.expected}</td>
                    <td className="py-1 text-green-700 text-xs">
                      {v.suggestedReplacement ?? "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}