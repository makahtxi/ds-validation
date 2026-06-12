import { EmptyState } from "@/components/ui/EmptyState";

export default function ConnectionsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Figma Connections</h1>
      <EmptyState
        title="Connect your Figma account"
        description="Link your Figma account to start auditing design system files. Coming soon in subtask 2."
      />
    </div>
  );
}
