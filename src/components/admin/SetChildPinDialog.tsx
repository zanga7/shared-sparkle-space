import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PinInput } from '@/components/ui/pin-input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SetChildPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childProfile: {
    id: string;
    display_name: string;
  } | null;
  onSuccess: () => void;
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

  const handleSavePin = async () => {
    if (!childProfile) return;

    if (pin !== confirmPin) {
      toast({
        title: "Error",
        description: "PINs do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (pin.length !== 4) {
      toast({
        title: "Error",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('set-child-pin', {
        body: {
          profileId: childProfile.id,
          pin: pin
        }
      });

      if (error) {
        throw error;
      }

      const result = data;

      if (result.success) {
        toast({
          title: "PIN Set Successfully",
          description: `PIN has been set for ${childProfile.display_name}`,
        });
        setPin('');
        setConfirmPin('');
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to set PIN",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error setting PIN:', error);
      toast({
        title: "Error",
        description: "Failed to set PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPin('');
    setConfirmPin('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Set PIN for {childProfile?.display_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Enter 4-digit PIN</Label>
            <PinInput
              value={pin}
              onChange={setPin}
              length={4}
              disabled={isLoading}
              className="justify-center"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirm PIN</Label>
            <PinInput
              value={confirmPin}
              onChange={setConfirmPin}
              length={4}
              disabled={isLoading}
              className="justify-center"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePin}
              disabled={isLoading || pin.length !== 4 || confirmPin.length !== 4}
            >
              {isLoading ? 'Setting PIN...' : 'Set PIN'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};