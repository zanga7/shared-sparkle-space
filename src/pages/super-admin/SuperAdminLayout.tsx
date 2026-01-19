import { Link, Outlet, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, Package, Settings, Link2, AppWindow, Type, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SuperAdminLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/super-admin/families', label: 'Families', icon: Users },
    { path: '/super-admin/plans', label: 'Plans', icon: Package },
    { path: '/super-admin/integrations', label: 'Integrations', icon: Link2 },
    { path: '/super-admin/app-settings', label: 'App Settings', icon: AppWindow },
    { path: '/super-admin/themes', label: 'Themes', icon: Settings },
    { path: '/super-admin/styles', label: 'Style Settings', icon: Type },
  ];

  const NavContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = item.exact 
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);
        
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    <span className="font-semibold">Super Admin</span>
                  </div>
                </div>
                <ScrollArea className="h-[calc(100vh-65px)] p-4">
                  <NavContent onItemClick={() => setMobileMenuOpen(false)} />
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">Super Admin</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">System Management Console</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <NavContent />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
