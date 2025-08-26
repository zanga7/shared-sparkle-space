import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, List, Calendar, Gift, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActiveMemberChip } from '@/components/dashboard/ActiveMemberChip';

interface Profile {
  id: string;
  display_name: string;
  color: string;
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
}

const navigationItems = [
  { label: 'Tasks', value: 'columns', icon: Users },
  { label: 'Lists', value: 'lists', icon: List },
  { label: 'Calendar', value: 'calendar', icon: Calendar },
  { label: 'Rewards', value: 'rewards', icon: Gift },
];

export function NavigationHeader({ 
  familyMembers, 
  selectedMember, 
  onMemberSelect,
  onSettingsClick,
  activeTab,
  onTabChange,
  activeMemberId,
  onMemberSwitch,
  dashboardMode = false
}: NavigationHeaderProps) {
  const activeMember = familyMembers.find(m => m.id === activeMemberId);

  return (
    <header className="w-full border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Main Navigation */}
        <nav className="flex items-center space-x-1">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Button
                key={item.value}
                variant={activeTab === item.value ? "default" : "ghost"}
                size="sm"
                onClick={() => onTabChange(item.value)}
                className={cn(
                  "h-9 px-3 font-medium transition-colors",
                  activeTab === item.value 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <IconComponent className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>

        {/* Member Management & Settings */}
        <div className="flex items-center space-x-3">
          {dashboardMode ? (
            <>
              {/* Dashboard Mode: Active Member + Member Switcher */}
              <ActiveMemberChip activeMember={activeMember} />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {/* TODO: Open member switch dialog */}}
                className="h-9 px-3 font-medium"
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Switch
              </Button>
            </>
          ) : (
            <>
              {/* Regular Mode: Filter UI */}
              <Button
                variant={selectedMember === null ? "default" : "ghost"}
                size="sm"
                onClick={() => onMemberSelect(null)}
                className="h-9 px-3 font-medium"
              >
                Everyone
              </Button>

              <div className="flex items-center space-x-2">
                {familyMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant={selectedMember === member.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onMemberSelect(member.id)}
                    className="h-9 px-2 font-medium flex items-center space-x-2"
                  >
                    <UserAvatar 
                      name={member.display_name} 
                      color={member.color} 
                      size="sm" 
                    />
                    <span className="hidden sm:inline">{member.display_name}</span>
                    <Badge 
                      variant="secondary" 
                      className="ml-1 text-xs font-semibold bg-background/80"
                    >
                      {member.total_points}
                    </Badge>
                  </Button>
                ))}
              </div>
            </>
          )}

          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            className="h-9 w-9 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}