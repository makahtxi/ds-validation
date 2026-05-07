import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "DS Validation",
  description: "Design system validation dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}