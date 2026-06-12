import { createClient } from "@/lib/supabase/server";
import { listAudits } from "@/lib/audit";
import Link from "next/link";

export default async function AuditsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p>Please sign in to view your audits.</p>
      </div>
    );
  }

  const audits = await listAudits(user.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audits</h1>
        <Link
          href="/audits/new"
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          New Audit
        </Link>
      </div>

      {audits.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No audits yet</p>
          <p>Start your first design system audit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map((audit) => (
            <Link
              key={audit.id}
              href={`/audits/${audit.id}`}
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{audit.file_name || audit.file_key}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(audit.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      audit.status === "done"
                        ? "bg-green-100 text-green-700"
                        : audit.status === "running"
                          ? "bg-blue-100 text-blue-700"
                          : audit.status === "queued"
                            ? "bg-yellow-100 text-yellow-700"
                            : audit.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {audit.status}
                  </span>
                  {audit.total_score !== null && (
                    <span className="text-lg font-semibold">{audit.total_score}/100</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}