import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminPinProtection } from "@/components/admin/AdminPinProtection";
import { useDashboardMode } from "@/hooks/useDashboardMode";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  const { requireParentPin, loading } = useDashboardMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const content = (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>

        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card px-4 flex items-center gap-3 sticky top-0 z-10">
            {/* Mobile Hamburger Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="default" 
                  className="md:hidden flex items-center gap-2"
                >
                  <Menu className="h-5 w-5" />
                  <span className="text-sm font-medium">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <AdminMobileMenu onItemClick={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            
            {/* Desktop Sidebar Trigger */}
            <div className="hidden md:block">
              <SidebarTrigger />
            </div>

            {/* Header Title */}
            <h1 className="text-sm font-semibold text-foreground ml-auto md:ml-0">Admin Panel</h1>
          </header>
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
