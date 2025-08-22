import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  display_name: string;
  color: string;
  total_points: number;
  role: string;
}

interface NavigationHeaderProps {
  familyMembers: Profile[];
  selectedMember: string | null;
  onMemberSelect: (memberId: string | null) => void;
  onSettingsClick: () => void;
}

const navigationItems = [
  { label: 'Family Hub', path: '/', icon: '🏠' },
  { label: 'Dashboard', path: '/', icon: '📊' },
  { label: 'Goals', path: '/goals', icon: '🎯' },
  { label: 'Tasks', path: '/', icon: '✅' },
  { label: 'Rewards', path: '/rewards', icon: '🎁' },
  { label: 'Calendar', path: '/calendar', icon: '📅' },
];

export function NavigationHeader({ 
  familyMembers, 
  selectedMember, 
  onMemberSelect,
  onSettingsClick 
}: NavigationHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="w-full border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Main Navigation */}
        <nav className="flex items-center space-x-1">
          {navigationItems.map((item) => (
            <Button
              key={item.path}
              variant={isActive(item.path) ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate(item.path)}
              className={cn(
                "h-9 px-3 font-medium transition-colors",
                isActive(item.path) 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <span className="mr-2 text-sm">{item.icon}</span>
              {item.label}
            </Button>
          ))}
        </nav>

        {/* Member Filters & Settings */}
        <div className="flex items-center space-x-3">
          {/* Everyone filter */}
          <Button
            variant={selectedMember === null ? "default" : "ghost"}
            size="sm"
            onClick={() => onMemberSelect(null)}
            className="h-9 px-3 font-medium"
          >
            Everyone
          </Button>

          {/* Member filters */}
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