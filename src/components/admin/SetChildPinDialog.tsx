import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NumberPad } from '@/components/ui/number-pad';
import { IconPinInput } from '@/components/ui/icon-pin-input';
import { PinInput } from '@/components/ui/pin-input';
import { Eye, EyeOff, Key, Hash, Palette } from 'lucide-react';

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
  const [pinType, setPinType] = useState<'numeric' | 'icon'>(member?.pin_type || 'numeric');
  const [inputMethod, setInputMethod] = useState<'manual' | 'numberpad'>('numberpad');
  const [iconPin, setIconPin] = useState('');
  const [confirmIconPin, setConfirmIconPin] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member) return;

    const currentPin = pinType === 'icon' ? iconPin : pin;
    const currentConfirmPin = pinType === 'icon' ? confirmIconPin : confirmPin;

    if (currentPin.length < 4) {
      toast({
        title: 'Invalid PIN',
        description: pinType === 'icon' ? 'Icon PIN must have at least 4 icons' : 'PIN must be at least 4 digits',
        variant: 'destructive'
      });
      return;
    }

    if (currentPin !== currentConfirmPin) {
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
          pin: currentPin,
          pinType: pinType
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
        setIconPin('');
        setConfirmIconPin('');
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

  const handleNumberPadPress = (number: string) => {
    if (pin.length < 8) {
      setPin(prev => prev + number);
    }
  };

  const handleNumberPadBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleConfirmNumberPadPress = (number: string) => {
    if (confirmPin.length < 8) {
      setConfirmPin(prev => prev + number);
    }
  };

  const handleConfirmNumberPadBackspace = () => {
    setConfirmPin(prev => prev.slice(0, -1));
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
          {/* PIN Type Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">PIN Type</Label>
            <Tabs value={pinType} onValueChange={(value) => setPinType(value as 'numeric' | 'icon')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="numeric" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Numbers
                </TabsTrigger>
                <TabsTrigger value="icon" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Icons
                </TabsTrigger>
              </TabsList>

              <TabsContent value="numeric" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="input-method">Input Method</Label>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="input-toggle" className="text-sm">Manual</Label>
                      <Switch
                        id="input-toggle"
                        checked={inputMethod === 'numberpad'}
                        onCheckedChange={(checked) => setInputMethod(checked ? 'numberpad' : 'manual')}
                      />
                      <Label htmlFor="input-toggle" className="text-sm">Number Pad</Label>
                    </div>
                  </div>

                  {inputMethod === 'manual' ? (
                    <>
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
                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Confirm PIN"
                            maxLength={8}
                            required
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>New PIN (4+ digits)</Label>
                        <PinInput
                          value={pin}
                          onChange={setPin}
                          length={pin.length > 6 ? 8 : pin.length > 4 ? 6 : 4}
                          disabled={loading}
                        />
                        <NumberPad
                          onNumberPress={handleNumberPadPress}
                          onDelete={handleNumberPadBackspace}
                          disabled={loading}
                        />
                      </div>

                      {pin.length >= 4 && (
                        <div className="space-y-2">
                          <Label>Confirm PIN</Label>
                          <PinInput
                            value={confirmPin}
                            onChange={setConfirmPin}
                            length={pin.length}
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
                  )}
                </div>
              </TabsContent>

              <TabsContent value="icon" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>New Icon PIN (4+ icons)</Label>
                    <IconPinInput
                      value={iconPin}
                      onChange={setIconPin}
                      length={4}
                      disabled={loading}
                    />
                  </div>

                  {iconPin.split(',').filter(Boolean).length >= 4 && (
                    <div className="space-y-2">
                      <Label>Confirm Icon PIN</Label>
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
              disabled={loading || (pinType === 'numeric' ? pin.length < 4 || confirmPin.length < 4 : iconPin.split(',').filter(Boolean).length < 4 || confirmIconPin.split(',').filter(Boolean).length < 4)} 
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