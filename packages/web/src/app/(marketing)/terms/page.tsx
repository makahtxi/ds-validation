export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
      <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-4">
        <p>
          By using DS Validation (&ldquo;the Service&rdquo;), you agree to these
          terms. The Service provides automated audits of Figma design system
          files.
        </p>
        <p>
          You retain all rights to your Figma files and design content. The
          Service accesses your files solely to perform audits you explicitly
          request. You are responsible for ensuring you have the right to
          authorize such access.
        </p>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any
          kind. We strive for accuracy but do not guarantee that audit results
          are complete or error-free.
        </p>
        <p>
          We reserve the right to modify these terms at any time. Continued use
          of the Service after changes constitutes acceptance of the new terms.
        </p>
        <p>
          Free usage during the beta period may be subject to rate limits. Paid
          plans and associated terms will be introduced when the Service exits
          beta.
        </p>
      </div>
    </div>
  );
}
