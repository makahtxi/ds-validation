import { describe, it, expect } from "vitest";

describe("route smoke tests", () => {
  it("renders landing page without throwing", async () => {
    const mod = await import("@/components/LandingPage");
    expect(mod.LandingPage).toBeDefined();
  });

  it("renders UI components without throwing", async () => {
    const { Button, ButtonLink } = await import("@/components/ui/Button");
    expect(Button).toBeDefined();
    expect(ButtonLink).toBeDefined();

    const { Input } = await import("@/components/ui/Input");
    expect(Input).toBeDefined();

    const { Skeleton, PageSkeleton } = await import("@/components/ui/Skeleton");
    expect(Skeleton).toBeDefined();
    expect(PageSkeleton).toBeDefined();

    const { EmptyState } = await import("@/components/ui/EmptyState");
    expect(EmptyState).toBeDefined();

    const { ErrorState } = await import("@/components/ui/ErrorState");
    expect(ErrorState).toBeDefined();
  });

  it("renders stub pages without throwing", async () => {
    const newAudit = await import("@/app/(app)/audits/new/page");
    expect(newAudit.default).toBeDefined();

    const auditDetail = await import("@/app/(app)/audits/[id]/page");
    expect(auditDetail.default).toBeDefined();

    const compDetail = await import("@/app/(app)/audits/[id]/components/[name]/page");
    expect(compDetail.default).toBeDefined();

    const fileHistory = await import("@/app/(app)/files/[fileKey]/page");
    expect(fileHistory.default).toBeDefined();

    const connections = await import("@/app/(app)/settings/connections/page");
    expect(connections.default).toBeDefined();
  });

  it("renders marketing pages without throwing", async () => {
    const login = await import("@/app/(marketing)/login/page");
    expect(login.default).toBeDefined();

    const privacy = await import("@/app/(marketing)/privacy/page");
    expect(privacy.default).toBeDefined();

    const terms = await import("@/app/(marketing)/terms/page");
    expect(terms.default).toBeDefined();
  });
});
