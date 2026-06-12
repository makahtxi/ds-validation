import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
        <span>DS Validation &mdash; design system conformance audit</span>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
