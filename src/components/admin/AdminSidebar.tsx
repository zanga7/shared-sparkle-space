import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Users,
  Settings,
  Shield,
  FileText,
  Database,
  Palette,
  BarChart3,
  Home,
  Archive,
  Download,
  RotateCcw,
  Calendar,
  Gift,
  ClipboardCheck,
  Monitor,
  Smartphone,
  LogOut,
  GraduationCap,
  Cake
} from "lucide-react";

const adminMenuItems = [
  { title: "Dashboard", url: "/admin", icon: Home, exact: true },
  { title: "Family Members", url: "/admin/members", icon: Users },
  { title: "Dashboard Mode", url: "/admin/dashboard", icon: Smartphone },
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

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const currentPath = location.pathname;

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string, exact?: boolean) => 
    exact ? currentPath === path : currentPath.startsWith(path);

  const getNavCls = (path: string, exact?: boolean) =>
    isActive(path, exact) ? "bg-primary text-primary-foreground" : "hover:bg-muted/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" className="hover:bg-muted/50">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Back to Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1">
          <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.exact}
                      className={getNavCls(item.url, item.exact)}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="hover:bg-destructive/10 text-destructive hover:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}