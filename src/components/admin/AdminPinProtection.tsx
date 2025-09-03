import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NumberPad } from '@/components/ui/number-pad';
import { IconPinInput } from '@/components/ui/icon-pin-input';
import { PinInput } from '@/components/ui/pin-input';
import { Shield, Eye, EyeOff, Calculator, Keyboard, Palette, RotateCcw } from 'lucide-react';

interface AdminPinProtectionProps {
  children: React.ReactNode;
}

export function AdminPinProtection({ children }: AdminPinProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [inputMethod, setInputMethod] = useState<'keypad' | 'manual' | 'icon'>('keypad');
  const [iconPin, setIconPin] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, pin_hash, pin_type')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setUserProfile(profile);

      if (profile.role === 'parent') {
        if (profile.pin_hash) {
          // Set input method based on pin type
          setInputMethod(profile.pin_type === 'icon' ? 'icon' : 'keypad');
          setShowPinDialog(true);
        } else {
          setIsAuthenticated(true);
        }
      } else {
        toast({
          title: 'Access Denied',
          description: 'Only parents can access the admin panel',
          variant: 'destructive'
        });
      }
    };

    checkUserRole();
  }, [user, toast]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentPin = inputMethod === 'icon' ? iconPin : pin;
    const pinType = inputMethod === 'icon' ? 'icon' : 'numeric';
    
    if (!currentPin || !userProfile) return;

    // Validate PIN format
    const actualPinLength = inputMethod === 'icon' 
      ? (currentPin ? currentPin.split(',').filter(Boolean).length : 0)
      : currentPin.length;
    
    if (actualPinLength !== 4) {
      const errorMsg = inputMethod === 'icon' ? 'Icon PIN must have exactly 4 icons' : 'PIN must be exactly 4 digits';
      toast({
        title: 'Invalid PIN',
        description: errorMsg,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('secure-pin-auth', {
        body: {
          profileId: userProfile.id,
          pin: currentPin,
          pinType: pinType
        }
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (result.success) {
        setIsAuthenticated(true);
        setShowPinDialog(false);
        setPin('');
        setIconPin('');
      } else {
        throw new Error(result.error || 'Invalid PIN');
      }
    } catch (error) {
      console.error('PIN authentication error:', error);
      toast({
        title: 'Authentication Failed',
        description: 'Invalid PIN. Please try again.',
        variant: 'destructive'
      });
      setPin('');
      setIconPin('');
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

  const clearPin = () => {
    setPin('');
  };

  const clearIconPin = () => {
    setIconPin('');
  };

  if (!user || !userProfile) {
    return <div>Loading...</div>;
  }

  if (userProfile.role !== 'parent') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only parents can access the admin panel</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Dialog open={showPinDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Access Required
            </DialogTitle>
            <DialogDescription>
              Please enter your PIN to access the admin panel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">PIN Input Method</Label>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Enter Admin PIN</Label>
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
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminPin">Admin PIN (4 digits)</Label>
                    <div className="relative">
                      <Input
                        id="adminPin"
                        type={showPin ? "text" : "password"}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Enter your 4-digit PIN"
                        maxLength={4}
                        disabled={loading}
                        required
                        autoFocus
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
                </TabsContent>

                <TabsContent value="icon" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Enter Icon PIN (4 icons)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearIconPin}
                        disabled={loading || iconPin.length === 0}
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
                </TabsContent>
              </Tabs>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Authenticating...' : 'Access Admin Panel'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return <>{children}</>;
}