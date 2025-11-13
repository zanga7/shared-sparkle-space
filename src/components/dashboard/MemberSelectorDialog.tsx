import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  display_name: string;
  color: string;
  avatar_url?: string | null;
  role: 'parent' | 'child';
  total_points?: number;
}

interface MemberSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Profile[];
  currentMemberId: string | null;
  onSelect: (memberId: string, member: Profile) => void;
}

export function MemberSelectorDialog({
  open,
  onOpenChange,
  members,
  currentMemberId,
  onSelect
}: MemberSelectorDialogProps) {
  const handleSelect = (member: Profile) => {
    onSelect(member.id, member);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Active Member</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Choose which family member you want to act as:
          </p>
          
          <div className="space-y-2">
            {members.map((member) => (
              <Button
                key={member.id}
                variant={currentMemberId === member.id ? "default" : "outline"}
                size="lg"
                onClick={() => handleSelect(member)}
                className={cn(
                  "w-full justify-start h-auto p-4",
                  currentMemberId === member.id && "bg-primary text-primary-foreground"
                )}
              >
                <UserAvatar 
                  name={member.display_name} 
                  color={member.color}
                  avatarIcon={member.avatar_url || undefined}
                  size="sm" 
                  className="mr-3" 
                />
                <div className="flex-1 text-left">
                  <div className="font-medium">{member.display_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-xs">
                      {member.role}
                    </Badge>
                    {member.total_points !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {member.total_points} pts
                      </Badge>
                    )}
                  </div>
                </div>
                {currentMemberId === member.id && (
                  <Badge variant="outline" className="ml-2">Active</Badge>
                )}
              </Button>
            ))}
          </div>
          
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}