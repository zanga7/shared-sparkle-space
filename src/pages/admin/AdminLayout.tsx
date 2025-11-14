import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminPinProtection } from "@/components/admin/AdminPinProtection";
import { useDashboardMode } from "@/hooks/useDashboardMode";

export default function AdminLayout() {
  const { requireParentPin, loading } = useDashboardMode();

  const content = (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-12 border-b bg-card px-4"></header>
          <div className="flex-1 p-4 sm:p-6 w-full overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );

  return (
    <AdminProvider>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <span className="text-sm text-muted-foreground">Loading settings...</span>
        </div>
      ) : requireParentPin ? (
        <AdminPinProtection>{content}</AdminPinProtection>
      ) : (
        content
      )}
    </AdminProvider>
  );
}
