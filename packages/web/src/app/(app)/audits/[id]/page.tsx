interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit {id}</h1>
      <p className="text-gray-500">Coming soon &mdash; subtasks 3, 4</p>
    </div>
  );
}
