import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link className="logo flex items-center gap-2.5 font-semibold text-gray-900 tracking-tight" href="/">
          <span className="w-5 h-5 rounded-sm bg-gradient-to-br from-blue-500 to-cyan-400" />
          DS<span className="text-gray-300">&middot;</span>
          <span className="text-gray-400">Validation</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
