import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b bg-card px-4">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-sm sm:text-base">Family Chores Admin</h2>
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-6 w-full overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}