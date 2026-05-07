import Link from "next/link";
import { scoreColor, scoreBg } from "../lib/utils";

interface ComponentGridProps {
  components: {
    name: string;
    score: number;
    jsonPath: string;
    passedChecks: number;
    totalChecks: number;
  }[];
}

export function ComponentGrid({ components }: ComponentGridProps) {
  if (components.length === 0) {
    return <p className="text-gray-500">No components audited.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {components.map((comp) => (
        <Link
          key={comp.name}
          href={`/components/${encodeURIComponent(comp.name)}`}
          className={`block border rounded-lg p-4 hover:shadow-md transition-shadow ${scoreBg(comp.score)}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{comp.name}</h3>
            <span className={`text-2xl font-bold ${scoreColor(comp.score)}`}>
              {comp.score}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {comp.passedChecks}/{comp.totalChecks} checks passed
          </p>
        </Link>
      ))}
    </div>
  );
}