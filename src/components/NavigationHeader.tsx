import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, List, Calendar, Gift, ArrowLeftRight, LayoutDashboard, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActiveMemberChip } from '@/components/dashboard/ActiveMemberChip';
import { useDashboardMode } from '@/hooks/useDashboardMode';
interface Profile {
  id: string;
  display_name: string;
  color: string;
  avatar_url?: string | null;
  total_points: number;
  role: 'parent' | 'child';
  require_pin_to_complete_tasks?: boolean;
  require_pin_for_list_deletes?: boolean;
  calendar_edit_permission?: 'open' | 'require_pin';
}
interface NavigationHeaderProps {
  familyMembers: Profile[];
  selectedMember: string | null;
  onMemberSelect: (memberId: string | null) => void;
  onSettingsClick: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeMemberId?: string | null;
  onMemberSwitch?: (memberId: string | null) => void;
  dashboardMode?: boolean;
  viewMode?: 'everyone' | 'member';
}
const navigationItems = [{
  label: 'Dashboard',
  value: 'dashboard',
  icon: LayoutDashboard
}, {
  label: 'Tasks',
  value: 'columns',
  icon: CheckCircle
}, {
  label: 'Lists',
  value: 'lists',
  icon: List
}, {
  label: 'Goals',
  value: 'goals',
  icon: Target
}, {
  label: 'Calendar',
  value: 'calendar',
  icon: Calendar
}];
export function NavigationHeader({
  familyMembers,
  selectedMember,
  onMemberSelect,
  onSettingsClick,
  activeTab,
  onTabChange,
  activeMemberId,
  onMemberSwitch,
  dashboardMode = false,
  viewMode = 'everyone'
}: NavigationHeaderProps) {
  const activeMember = familyMembers.find(m => m.id === activeMemberId);
  const {
    dashboardModeEnabled,
    requireParentPin
  } = useDashboardMode();
  return <header className="w-full border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="w-full px-2 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 relative">
        {/* Main Navigation - Always visible */}
        <nav className="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0">
          {navigationItems.map(item => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.value;
          return <Button key={item.value} variant={isActive ? "default" : "ghost"} size="sm" onClick={() => onTabChange(item.value)} className={cn("h-8 sm:h-9 font-medium transition-colors",
          // On mobile/tablet: icon only for inactive, icon + label for active
          isActive ? "px-2 sm:px-3" : "px-2 sm:px-3", isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                <IconComponent className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4",
            // Add margin only when label is shown
            isActive ? "mr-1.5 sm:mr-2" : "sm:mr-2")} />
                {/* On mobile: show label only for active item. On desktop (sm+): show all labels */}
                <span className={cn("text-xs sm:text-sm", isActive ? "inline" : "hidden sm:inline")}>
                  {item.label}
                </span>
              </Button>;
        })}
        </nav>

        {/* Member Management & Settings */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-1 justify-end mr-12 overflow-x-auto">
          {dashboardMode && activeMember && requireParentPin ? <>
              {/* Dashboard Mode with PIN: Active Member + Member Switcher */}
              <ActiveMemberChip activeMember={activeMember} />
              
              <Button variant="outline" size="sm" onClick={() => onMemberSwitch && onMemberSwitch(null)} className="h-8 sm:h-9 px-2 sm:px-3 font-medium flex-shrink-0">
                <ArrowLeftRight className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Switch</span>
              </Button>
            </> : <>
              {/* Member selection for dashboard views */}
              <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
                {familyMembers.map(member => <Button key={member.id} variant={selectedMember === member.id && viewMode === 'member' ? "default" : "ghost"} size="sm" onClick={() => onMemberSelect(member.id)} className="h-8 sm:h-9 px-1 sm:px-2 font-medium flex-shrink-0 flex items-center justify-center gap-[8px]">
                    <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="sm" />
                    <span className="hidden md:inline text-xs sm:text-sm">{member.display_name}</span>
                    {/* Hide scores on mobile, show on sm+ */}
                    <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] sm:text-xs font-semibold bg-background/80 px-1 border border-muted-foreground sm:px-[10px]">
                      {member.total_points}
                    </Badge>
                  </Button>)}
              </div>
            </>}
        </div>
        
        {/* Settings - Fixed to top right corner */}
        <Button variant="ghost" size="sm" onClick={onSettingsClick} className="h-8 sm:h-9 w-8 sm:w-9 p-0 absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex-shrink-0">
          <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </header>;
}