import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/LandingPage";
import { AppDashboard } from "@/components/AppDashboard";
import { loadAuditData } from "@/lib/loadAuditData";

export default async function HomePage() {
  const hasSession = await checkSession();
  const hasLocalData = !!loadAuditData();

  if (hasSession) {
    return <AppDashboard />;
  }

  if (hasLocalData) {
    return <AppDashboard />;
  }

  return <LandingPage />;
}

async function checkSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}
