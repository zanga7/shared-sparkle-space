import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EnhancedPinInput } from '@/components/ui/enhanced-pin-input';
import { UserAvatar } from '@/components/ui/user-avatar';

interface Profile {
  id: string;
  display_name: string;
  color: string;
  role: 'parent' | 'child';
}

interface MemberPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Profile;
  onSuccess: () => void;
  onAuthenticate: (pin: string) => Promise<boolean>;
  isAuthenticating: boolean;
  action?: string;
}

export function MemberPinDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
  onAuthenticate,
  isAuthenticating,
  action = "perform this action"
}: MemberPinDialogProps) {
  const [pin, setPin] = useState('');

  const handleSubmit = async () => {
    // Check if PIN has the right format (4 digits or 4 icons)
    const isValidPin = pin.includes(',') ? 
      pin.split(',').filter(Boolean).length === 4 : 
      pin.length === 4;
    
    if (!isValidPin) return;
    
    const success = await onAuthenticate(pin);
    if (success) {
      setPin('');
      onOpenChange(false);
      onSuccess();
    } else {
      setPin('');
    }
  };

  const handleClose = () => {
    setPin('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar 
              name={member.display_name} 
              color={member.color} 
              size="sm" 
            />
            Enter PIN for {member.display_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <p className="text-sm text-muted-foreground text-center">
            {member.display_name} needs to verify their PIN to {action}
          </p>
          
          <div className="flex justify-center">
            <EnhancedPinInput
              value={pin}
              onChange={setPin}
              onComplete={handleSubmit}
              length={4}
              disabled={isAuthenticating}
              allowIconPin={true}
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isAuthenticating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                (pin.includes(',') ? 
                  pin.split(',').filter(Boolean).length !== 4 : 
                  pin.length !== 4) || 
                isAuthenticating
              }
            >
              {isAuthenticating ? "Verifying..." : "Verify PIN"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}