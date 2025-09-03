import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NumberPad } from '@/components/ui/number-pad';
import { IconPinInput } from '@/components/ui/icon-pin-input';
import { PinInput } from '@/components/ui/pin-input';
import { Eye, EyeOff, Key, Hash, Palette, X, RotateCcw, Keyboard, Calculator } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
  pin_hash?: string | null;
  pin_type?: 'numeric' | 'icon';
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
  const [inputMethod, setInputMethod] = useState<'keypad' | 'manual' | 'icon'>('keypad');
  const [iconPin, setIconPin] = useState('');
  const [confirmIconPin, setConfirmIconPin] = useState('');
  const { toast } = useToast();

  // Clear all state when dialog opens or input method changes
  const clearAllState = () => {
    console.log('Clearing all PIN state');
    setPin('');
    setConfirmPin('');
    setIconPin('');
    setConfirmIconPin('');
    setShowPin(false);
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      console.log('Dialog opened, clearing state');
      clearAllState();
      setInputMethod('keypad'); // Reset to default method
    }
  }, [open]);

  // Clear state when switching input methods
  useEffect(() => {
    console.log('Input method changed to:', inputMethod);
    clearAllState();
  }, [inputMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member) {
      console.error('No member provided for PIN setting');
      return;
    }

    const currentPin = inputMethod === 'icon' ? iconPin : pin;
    const currentConfirmPin = inputMethod === 'icon' ? confirmIconPin : confirmPin;
    const pinType = inputMethod === 'icon' ? 'icon' : 'numeric';

    console.log('PIN submission details:', {
      inputMethod,
      pinType,
      currentPinLength: currentPin.length,
      confirmPinLength: currentConfirmPin.length,
      memberId: member.id
    });

    // Enhanced validation
    const actualPinLength = inputMethod === 'icon' 
      ? (currentPin ? currentPin.split(',').filter(Boolean).length : 0)
      : currentPin.length;
    
    if (actualPinLength !== 4) {
      const errorMsg = inputMethod === 'icon' ? 'Icon PIN must have exactly 4 icons' : 'PIN must be exactly 4 digits';
      console.error('PIN length validation failed:', { actualPinLength, expected: 4 });
      toast({
        title: 'Invalid PIN',
        description: errorMsg,
        variant: 'destructive'
      });
      return;
    }

    if (currentPin !== currentConfirmPin) {
      console.error('PIN confirmation mismatch');
      toast({
        title: 'PIN Mismatch',
        description: 'PIN and confirmation do not match',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Calling set-child-pin function...');
      const { data, error } = await supabase.functions.invoke('set-child-pin', {
        body: {
          profileId: member.id,
          pin: currentPin,
          pinType: pinType
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (result.success) {
        console.log('PIN set successfully');
        toast({
          title: 'Success',
          description: result.message || 'PIN has been set successfully',
        });
        
        clearAllState();
        onOpenChange(false);
        onPinUpdated();
      } else {
        console.error('Function returned error:', result.error);
        throw new Error(result.error || 'Failed to set PIN');
      }
    } catch (error) {
      console.error('Error setting PIN:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set PIN. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNumberPadPress = (number: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + number);
    }
  };

  const handleNumberPadBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleConfirmNumberPadPress = (number: string) => {
    if (confirmPin.length < 4) {
      setConfirmPin(prev => prev + number);
    }
  };

  const handleConfirmNumberPadBackspace = () => {
    setConfirmPin(prev => prev.slice(0, -1));
  };

  const clearPin = () => {
    setPin('');
  };

  const clearConfirmPin = () => {
    setConfirmPin('');
  };

  const clearIconPin = () => {
    setIconPin('');
  };

  const clearConfirmIconPin = () => {
    setConfirmIconPin('');
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input Method Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Input Method</Label>
            <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as 'keypad' | 'manual' | 'icon')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="keypad" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Keypad
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  Manual
                </TabsTrigger>
                <TabsTrigger value="icon" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Icons
                </TabsTrigger>
              </TabsList>

              <TabsContent value="keypad" className="space-y-4">
                <div className="space-y-4">
                  {pin.length < 4 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>New PIN (4 digits)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearPin}
                          disabled={loading || pin.length === 0}
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                      <PinInput
                        value={pin}
                        onChange={setPin}
                        length={4}
                        disabled={loading}
                      />
                      <NumberPad
                        onNumberPress={handleNumberPadPress}
                        onDelete={handleNumberPadBackspace}
                        disabled={loading}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Confirm PIN</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearConfirmPin}
                          disabled={loading || confirmPin.length === 0}
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                      <PinInput
                        value={confirmPin}
                        onChange={setConfirmPin}
                        length={4}
                        disabled={loading}
                      />
                      <NumberPad
                        onNumberPress={handleConfirmNumberPadPress}
                        onDelete={handleConfirmNumberPadBackspace}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pin">New PIN (4 digits)</Label>
                    <div className="relative">
                      <Input
                        id="pin"
                        type={showPin ? "text" : "password"}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Enter 4-digit PIN"
                        maxLength={4}
                        disabled={loading}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPin(!showPin)}
                        disabled={loading}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Confirm 4-digit PIN"
                        maxLength={4}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="icon" className="space-y-4">
                <div className="space-y-4">
                  {!iconPin || iconPin.split(',').filter(Boolean).length < 4 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>New Icon PIN (4 icons)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearIconPin}
                          disabled={loading || !iconPin}
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                      <IconPinInput
                        value={iconPin}
                        onChange={setIconPin}
                        length={4}
                        disabled={loading}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Confirm Icon PIN</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearConfirmIconPin}
                          disabled={loading || !confirmIconPin}
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                      <IconPinInput
                        value={confirmIconPin}
                        onChange={setConfirmIconPin}
                        length={4}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full"
            >
              {loading ? 'Setting PIN...' : `${member?.pin_hash ? 'Update' : 'Set'} PIN`}
            </Button>
            
            {member?.pin_hash && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={removePIN}
                disabled={loading}
                className="w-full flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Remove
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