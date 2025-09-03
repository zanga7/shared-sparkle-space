import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Key } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
  pin_hash?: string | null;
}

interface SetChildPinDialogProps {
  member: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPinUpdated: () => void;
}

export function SetChildPinDialog({ member, open, onOpenChange, onPinUpdated }: SetChildPinDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member) return;

    if (pin.length < 4) {
      toast({
        title: 'Invalid PIN',
        description: 'PIN must be at least 4 digits',
        variant: 'destructive'
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: 'PIN Mismatch',
        description: 'PIN and confirmation do not match',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('set-child-pin', {
        body: {
          profileId: member.id,
          pin: pin
        }
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'PIN has been set successfully',
        });
        
        setPin('');
        setConfirmPin('');
        onOpenChange(false);
        onPinUpdated();
      } else {
        throw new Error(result.error || 'Failed to set PIN');
      }
    } catch (error) {
      console.error('Error setting PIN:', error);
      toast({
        title: 'Error',
        description: 'Failed to set PIN. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const removePIN = async () => {
    if (!member) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          pin_hash: null,
          failed_pin_attempts: 0,
          pin_locked_until: null
        })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'PIN has been removed successfully',
      });

      onOpenChange(false);
      onPinUpdated();
    } catch (error) {
      console.error('Error removing PIN:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove PIN',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {member?.pin_hash ? 'Update' : 'Set'} PIN for {member?.display_name}
          </DialogTitle>
          <DialogDescription>
            {member?.pin_hash 
              ? 'Update or remove the current PIN for this member.'
              : 'Set a PIN to secure this member\'s actions in dashboard mode.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">New PIN (4+ digits)</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter PIN"
                maxLength={8}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <div className="relative">
              <Input
                id="confirmPin"
                type={showPin ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Confirm PIN"
                maxLength={8}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Setting PIN...' : `${member?.pin_hash ? 'Update' : 'Set'} PIN`}
            </Button>
            
            {member?.pin_hash && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={removePIN}
                disabled={loading}
                className="w-full"
              >
                Remove PIN
              </Button>
            )}
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}