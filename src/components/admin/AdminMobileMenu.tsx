import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Shield,
  Database,
  Palette,
  BarChart3,
  Home,
  RotateCcw,
  Calendar,
  Gift,
  ClipboardCheck,
  Monitor,
  LogOut,
  GraduationCap,
  Cake
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const adminMenuItems = [
  { title: "Dashboard", url: "/admin", icon: Home, exact: true },
  { title: "Family Members", url: "/admin/members", icon: Users },
  { title: "Rotating Tasks", url: "/admin/rotating-tasks", icon: RotateCcw },
  { title: "Rotation Debugger", url: "/admin/rotation-debugger", icon: Database },
  { title: "Rewards", url: "/admin/rewards", icon: Gift },
  { title: "Reward Approvals", url: "/admin/reward-approvals", icon: ClipboardCheck },
  { title: "Celebrations", url: "/admin/celebrations", icon: Cake },
  { title: "Calendar Settings", url: "/admin/calendar-settings", icon: Calendar },
  { title: "Holiday Management", url: "/admin/holidays", icon: GraduationCap },
  { title: "Screen Saver", url: "/admin/screensaver", icon: Monitor },
  { title: "Permissions", url: "/admin/permissions", icon: Shield },
  { title: "Theme Management", url: "/admin/themes", icon: Palette },
];

interface AdminMobileMenuProps {
  onItemClick?: () => void;
}

export function AdminMobileMenu({ onItemClick }: AdminMobileMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const currentPath = location.pathname;

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
    onItemClick?.();
  };

  const handleNavClick = () => {
    onItemClick?.();
  };

  const isActive = (path: string, exact?: boolean) => 
    exact ? currentPath === path : currentPath.startsWith(path);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <NavLink
            to="/"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </NavLink>

          <Separator className="my-2" />

          {adminMenuItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.exact}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.url, item.exact)
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t mt-auto">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          <span>Log Out</span>
        </Button>
      </div>
    </div>
  );
}
