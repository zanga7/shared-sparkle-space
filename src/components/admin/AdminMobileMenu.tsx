import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { adminMenuItems, backToDashboardItem } from "./adminMenuConfig";

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

  const handleNavClick = (url: string) => {
    navigate(url);
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
          <button
            onClick={() => handleNavClick(backToDashboardItem.url)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors w-full text-left"
          >
            <backToDashboardItem.icon className="h-4 w-4" />
            <span>{backToDashboardItem.title}</span>
          </button>

          <Separator className="my-2" />

          {adminMenuItems.map((item) => (
            <button
              key={item.title}
              onClick={() => handleNavClick(item.url)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full text-left ${
                isActive(item.url, item.exact)
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </button>
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
