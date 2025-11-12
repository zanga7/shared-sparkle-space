import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminPinProtection } from "@/components/admin/AdminPinProtection";

export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminPinProtection>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AdminSidebar />
            <main className="flex-1 flex flex-col">
              <header className="h-12 border-b bg-card px-4">
              </header>
              <div className="flex-1 p-4 sm:p-6 w-full overflow-auto">
                <Outlet />
              </div>
            </main>
          </div>
        </SidebarProvider>
      </AdminPinProtection>
    </AdminProvider>
  );
}