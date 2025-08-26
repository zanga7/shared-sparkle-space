import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';

interface Profile {
  id: string;
  display_name: string;
  color: string;
  role: 'parent' | 'child';
  require_pin_to_complete_tasks?: boolean;
  require_pin_for_list_deletes?: boolean;
}

interface MemberSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Profile[];
  currentMemberId: string | null;
  requiredMemberId: string;
  onSwitch: (memberId: string, member: Profile) => void;
  action: string;
}

export function MemberSwitchDialog({
  open,
  onOpenChange,
  members,
  currentMemberId,
  requiredMemberId,
  onSwitch,
  action
}: MemberSwitchDialogProps) {
  const requiredMember = members.find(m => m.id === requiredMemberId);
  const currentMember = members.find(m => m.id === currentMemberId);

  const handleSwitch = () => {
    if (requiredMember) {
      onSwitch(requiredMember.id, requiredMember);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Member Required</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              To {action}, you need to switch to the assigned member:
            </p>
            
            {currentMember && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Currently:</span>
                <Badge variant="outline" className="h-8 px-2">
                  <UserAvatar 
                    name={currentMember.display_name} 
                    color={currentMember.color} 
                    size="sm" 
                    className="mr-2" 
                  />
                  {currentMember.display_name}
                </Badge>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Switch to:</span>
              <Badge variant="default" className="h-8 px-2">
                <UserAvatar 
                  name={requiredMember?.display_name || ''} 
                  color={requiredMember?.color || 'sky'} 
                  size="sm" 
                  className="mr-2" 
                />
                {requiredMember?.display_name}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSwitch}>
              Switch to {requiredMember?.display_name}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}