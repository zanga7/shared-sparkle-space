import {
  Users,
  Shield,
  Home,
  RotateCcw,
  Calendar,
  Gift,
  ClipboardCheck,
  Monitor,
  GraduationCap,
  Cake,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface AdminMenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
}

// Single source of truth for admin menu items
export const adminMenuItems: AdminMenuItem[] = [
  { title: "Dashboard", url: "/admin", icon: Home, exact: true },
  { title: "Family Members", url: "/admin/members", icon: Users },
  { title: "Rotating Tasks", url: "/admin/rotating-tasks", icon: RotateCcw },
  { title: "Rewards", url: "/admin/rewards", icon: Gift },
  { title: "Reward Approvals", url: "/admin/reward-approvals", icon: ClipboardCheck },
  { title: "Celebrations", url: "/admin/celebrations", icon: Cake },
  { title: "Calendar Settings", url: "/admin/calendar-settings", icon: Calendar },
  { title: "Holiday Management", url: "/admin/holidays", icon: GraduationCap },
  { title: "Screen Saver", url: "/admin/screensaver", icon: Monitor },
  { title: "Permissions", url: "/admin/permissions", icon: Shield },
];

// Back to dashboard link
export const backToDashboardItem: AdminMenuItem = {
  title: "Back to Dashboard",
  url: "/",
  icon: BarChart3,
};
