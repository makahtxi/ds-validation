interface PageProps {
  params: Promise<{ fileKey: string }>;
}

export default async function FileHistoryPage({ params }: PageProps) {
  const { fileKey } = await params;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">File History</h1>
      <p className="text-sm text-gray-500 mb-4 font-mono">{fileKey}</p>
      <p className="text-gray-500">Coming soon &mdash; subtask 4</p>
    </div>
  );
}
