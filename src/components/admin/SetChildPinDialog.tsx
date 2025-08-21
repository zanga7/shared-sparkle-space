import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExtendedProfile } from '@/types/admin';

interface SetChildPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childProfile: ExtendedProfile | null;
  onSuccess?: () => void;
}

export const SetChildPinDialog = ({ 
  open, 
  onOpenChange, 
  childProfile,
  onSuccess 
}: SetChildPinDialogProps) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!childProfile) return;

    if (pin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "The PINs do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('set_child_pin', {
        profile_id_param: childProfile.id,
        new_pin: pin
      });

      if (error) {
        console.error('Set PIN error:', error);
        toast({
          title: "Error",
          description: "Failed to set PIN. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const result = data as { success: boolean; error?: string; message?: string };

      if (result.success) {
        toast({
          title: "PIN Set Successfully",
          description: `PIN has been set for ${childProfile.display_name}`,
        });
        
        setPin('');
        setConfirmPin('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Failed to Set PIN",
          description: result.error || "An error occurred while setting the PIN.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Set PIN error:', error);
      toast({
        title: "Error",
        description: "Failed to set PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setConfirmPin('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Set PIN for {childProfile?.display_name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">New PIN (4 digits)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Confirm 4-digit PIN"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || pin.length !== 4 || confirmPin.length !== 4}
            >
              {isLoading ? 'Setting PIN...' : 'Set PIN'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};