export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
      <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-4">
        <p>
          DS Validation accesses your Figma files to perform design system
          conformance audits. We read your file structure, component metadata,
          styles, and variables to check for token misuse.
        </p>
        <p>
          We do not store your Figma file contents permanently. Audit results
          (scores, violations, and component summaries) are saved to your
          account so you can track progress over time.
        </p>
        <p>
          Your Figma authentication tokens are encrypted at rest. You can revoke
          access at any time from your Figma account settings or from the DS
          Validation settings page.
        </p>
        <p>
          We use Supabase for authentication and data storage. Authentication
          data (email, OAuth provider IDs) is stored in accordance with
          Supabase&apos;s security practices.
        </p>
        <p>
          We do not sell, share, or use your data for any purpose other than
          providing the audit service. This is a paid tool &mdash; you are the
          customer, not the product.
        </p>
      </div>
    </div>
  );
}
