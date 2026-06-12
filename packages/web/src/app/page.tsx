import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/LandingPage";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const hasSession = await checkSession();

  if (hasSession) {
    redirect("/audits");
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
