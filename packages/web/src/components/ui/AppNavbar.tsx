"use client";

import Link from "next/link";
import { Button } from "./Button";

export function AppNavbar() {
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-gray-900 tracking-tight shrink-0"
        >
          <span className="w-5 h-5 rounded-sm bg-gradient-to-br from-blue-500 to-cyan-400" />
          DS<span className="text-gray-300">&middot;</span>
          <span className="text-gray-400">Validation</span>
        </Link>

        <div className="flex-1" />

        <Link href="/audits/new">
          <Button variant="primary" size="sm">
            New Audit
          </Button>
        </Link>

        <Link
          href="/settings/connections"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Settings
        </Link>
      </div>
    </header>
  );
}
