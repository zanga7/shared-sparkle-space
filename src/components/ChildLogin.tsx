import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useChildAuth } from '@/hooks/useChildAuth';
import { PinInput } from '@/components/ui/pin-input';
import { ArrowLeft } from 'lucide-react';

export const ChildLogin = () => {
  const { 
    childProfiles, 
    selectedChildId, 
    loading, 
    authenticateChild, 
    selectChild, 
    signOutChild 
  } = useChildAuth();
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const selectedProfile = childProfiles.find(p => p.id === selectedChildId);

  const handlePinComplete = async (value: string) => {
    if (!selectedChildId) return;
    
    setIsAuthenticating(true);
    const success = await authenticateChild(selectedChildId, value);
    
    if (!success) {
      setPin('');
    }
    setIsAuthenticating(false);
  };

  const handleBackToSelection = () => {
    setPin('');
    signOutChild();
  };

  const isProfileLocked = (profile: any) => {
    if (!profile.pin_locked_until) return false;
    return new Date(profile.pin_locked_until) > new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base">Loading...</p>
        </div>
      </div>
    );
  }

  if (selectedChildId && selectedProfile) {
    const locked = isProfileLocked(selectedProfile);
    
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelection}
              className="absolute left-4 top-4"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <UserAvatar 
              name={selectedProfile.display_name} 
              color={selectedProfile.color}
              size="lg" 
              className="mx-auto mb-4"
            />
            <CardTitle className="text-lg sm:text-xl">Welcome back, {selectedProfile.display_name}!</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {locked ? 'Account is temporarily locked. Try again later.' : 'Enter your PIN to continue'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!locked ? (
              <div className="space-y-4">
                <PinInput
                  value={pin}
                  onChange={setPin}
                  onComplete={handlePinComplete}
                  disabled={isAuthenticating}
                  length={4}
                />
                {isAuthenticating && (
                  <div className="text-center text-sm text-muted-foreground">
                    Authenticating...
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-destructive">
                This account is locked due to too many failed attempts.
                Please try again later.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-lg sm:text-xl">Choose Your Profile</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Select your profile to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
            {childProfiles.map((profile) => {
              const locked = isProfileLocked(profile);
              
              return (
                <Button
                  key={profile.id}
                  variant="ghost"
                  className="flex flex-col items-center p-4 sm:p-6 h-auto space-y-3 hover:bg-accent touch-target"
                  onClick={() => selectChild(profile.id)}
                  disabled={locked}
                >
                  <UserAvatar 
                    name={profile.display_name}
                    color={profile.color}
                    size="lg"
                    className={locked ? 'opacity-50' : ''}
                  />
                  <div className="text-center">
                    <div className="font-medium">
                      {profile.display_name}
                    </div>
                    {locked && (
                      <div className="text-xs text-destructive mt-1">
                        Locked
                      </div>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
          
          {childProfiles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No child profiles found. Ask a parent to create your profile.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};