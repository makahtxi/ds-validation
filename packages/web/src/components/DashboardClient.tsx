"use client";

import { useRouter } from "next/navigation";
import { MatrixSection } from "./MatrixSection";
import { ComponentTable } from "./ComponentTable";

interface DashboardClientProps {
  audit: {
    meta: {
      figmaFileKey: string;
      figmaFileName: string;
      auditedAt: string;
      pagesAudited: string[];
      conformanceChecks: { id: string; name: string; weight: number }[];
    };
    totalScore: number;
    components: {
      name: string;
      score: number;
      passedChecks: number;
      totalChecks: number;
      pageName: string;
      jsonPath: string;
    }[];
  };
}

export function DashboardClient({ audit }: DashboardClientProps) {
  const router = useRouter();

  function handlePick(slug: string) {
    router.push(`/components/${slug}`);
  }

  return (
    <>
      <MatrixSection audit={audit} onPick={handlePick} />
      <ComponentTable audit={audit} onPick={handlePick} />
    </>
  );
}
