import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminPinProtection } from "@/components/admin/AdminPinProtection";
import { useDashboardMode } from "@/hooks/useDashboardMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  const { requireParentPin, loading } = useDashboardMode();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const content = (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>

        <main className="flex-1 flex flex-col">
          <header className="h-12 border-b bg-card px-4 flex items-center gap-2">
            {/* Mobile Hamburger Menu */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  <AdminSidebar onItemClick={() => setMobileMenuOpen(false)} />
                </SheetContent>
              </Sheet>
            )}
            
            {/* Desktop Sidebar Trigger */}
            {!isMobile && <SidebarTrigger />}
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
