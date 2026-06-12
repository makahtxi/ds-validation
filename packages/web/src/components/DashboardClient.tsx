"use client";

import { useRouter } from "next/navigation";
import type { AuditResult } from "@ds-validation/core";
import { MatrixSection } from "./MatrixSection";
import { ComponentTable } from "./ComponentTable";

interface DashboardClientProps {
  audit: AuditResult;
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
