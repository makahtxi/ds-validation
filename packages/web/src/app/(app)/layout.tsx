import { AppNavbar } from "@/components/ui/AppNavbar";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <AppNavbar />
        <main className="flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
