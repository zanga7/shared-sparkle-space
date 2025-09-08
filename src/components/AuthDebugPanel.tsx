import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const AuthDebugPanel = () => {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [profileStatus, setProfileStatus] = useState<any>(null);
  const { user, session } = useAuth();

  const checkAuthStatus = async () => {
    try {
      // Check session from auth context
      console.log('Auth Context - User:', user?.id, 'Session:', !!session);

      // Check session directly from supabase
      const { data: { session: directSession }, error: sessionError } = await supabase.auth.getSession();
      console.log('Direct Session Check:', directSession?.user?.id, 'Error:', sessionError);

      // Check user directly from supabase
      const { data: { user: directUser }, error: userError } = await supabase.auth.getUser();
      console.log('Direct User Check:', directUser?.id, 'Error:', userError);

      setAuthStatus({
        contextUser: user?.id || null,
        contextSession: !!session,
        directSession: directSession?.user?.id || null,
        directUser: directUser?.id || null,
        sessionError,
        userError
      });

      // Check if user has profiles
      if (directUser) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, family_id, role')
          .eq('user_id', directUser.id);

        setProfileStatus({
          profiles: profiles || [],
          profileError,
          profileCount: profiles?.length || 0
        });
      }
    } catch (error) {
      console.error('Auth debug error:', error);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, [user, session]);

  const createMissingProfile = async () => {
    try {
      const result = await supabase.rpc('fix_my_missing_profile');
      console.log('Create profile result:', result);
      await checkAuthStatus(); // Refresh status
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const signInAsDemo = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@example.com',
        password: 'demo123456'
      });
      if (error) {
        console.error('Demo sign in error:', error);
      } else {
        console.log('Signed in as demo user');
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <Card className="bg-red-50 border-red-200 mb-4">
      <CardHeader>
        <CardTitle className="text-sm text-red-700">Authentication Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs space-y-1">
          <div><strong>Context User:</strong> {authStatus?.contextUser || 'None'}</div>
          <div><strong>Context Session:</strong> {authStatus?.contextSession ? 'Yes' : 'No'}</div>
          <div><strong>Direct Session User:</strong> {authStatus?.directSession || 'None'}</div>
          <div><strong>Direct User:</strong> {authStatus?.directUser || 'None'}</div>
          {authStatus?.sessionError && <div className="text-red-600"><strong>Session Error:</strong> {authStatus.sessionError.message}</div>}
          {authStatus?.userError && <div className="text-red-600"><strong>User Error:</strong> {authStatus.userError.message}</div>}
        </div>
        
        {profileStatus && (
          <div className="text-xs space-y-1 border-t pt-2">
            <div><strong>Profile Count:</strong> {profileStatus.profileCount}</div>
            {profileStatus.profiles.map((profile: any) => (
              <div key={profile.id} className="ml-2">
                • {profile.display_name} ({profile.role}) - Family: {profile.family_id}
              </div>
            ))}
            {profileStatus.profileError && <div className="text-red-600"><strong>Profile Error:</strong> {profileStatus.profileError.message}</div>}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={checkAuthStatus}>Refresh Status</Button>
          {authStatus?.directUser && profileStatus?.profileCount === 0 && (
            <Button size="sm" variant="outline" onClick={createMissingProfile}>
              Create Profile
            </Button>
          )}
          {!authStatus?.directUser && (
            <Button size="sm" variant="outline" onClick={signInAsDemo}>
              Sign In as Demo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};