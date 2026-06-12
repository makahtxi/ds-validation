import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

export function createServiceClient() {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.DEALZVhXZLTLgR0NFGzgKjVlAjAMyFsGZ4j_ljqJT_A";

  serviceClient = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  return serviceClient;
}
