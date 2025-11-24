import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, Settings, ExternalLink, RefreshCw, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/types/task';
import { TokenEncryptionStatus } from '@/components/security/TokenEncryptionStatus';
import { CalendarSelectionModal } from '@/components/admin/CalendarSelectionModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarSecurityMonitor } from '@/components/admin/CalendarSecurityMonitor';
import { TokenSecurityManager } from '@/components/admin/TokenSecurityManager';

const CalendarSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  // Calendar integrations temporarily removed
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIntegration, setDeletingIntegration] = useState<any | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarModalData, setCalendarModalData] = useState<{
    calendars: any[];
    tokens: any;
    integrationType: 'google' | 'microsoft';
    profileId: string;
  } | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState<{
    needs_migration: boolean;
    legacy_integrations: number;
    total_integrations: number;
  } | null>(null);
  const [cleaningLegacy, setCleaningLegacy] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
      checkLegacyIntegrations();
    }
  }, [user]);

  const checkLegacyIntegrations = async () => {
    try {
      const { data, error } = await supabase.rpc('get_calendar_integration_status');
      
      if (error) {
        console.error('Error checking legacy integrations:', error);
        return;
      }

      setLegacyStatus(data as { needs_migration: boolean; legacy_integrations: number; total_integrations: number });
    } catch (error) {
      console.error('Error checking legacy integrations:', error);
    }
  };

  const handleRemoveLegacyIntegrations = async () => {
    setCleaningLegacy(true);
    try {
      const { data, error } = await supabase.rpc('remove_legacy_calendar_integrations');
      
      if (error) throw error;

      const result = data as { success: boolean; message?: string; deleted_count: number };

      toast({
        title: 'Legacy Connections Removed',
        description: result.message || 'Please reconnect your calendars with the updated encryption.',
      });

      // Refresh data
      await fetchUserData();
      await checkLegacyIntegrations();
    } catch (error: any) {
      console.error('Error removing legacy integrations:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove legacy integrations',
        variant: 'destructive',
      });
    } finally {
      setCleaningLegacy(false);
    }
  };

  // Check for OAuth callback parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      toast({
        title: 'Connection Failed',
        description: `Failed to connect calendar: ${error}`,
        variant: 'destructive'
      });
      // Clean URL
      window.history.replaceState({}, '', '/admin/calendar-settings');
      return;
    }

    if (code && state) {
      // Determine provider from state or URL
      const stateData = JSON.parse(state);
      const provider = stateData.provider || 'google'; // Determine based on your state structure
      
      // Process OAuth callback
      handleOAuthCallback(code, state, provider as 'google' | 'microsoft');
      // Clean URL
      window.history.replaceState({}, '', '/admin/calendar-settings');
    }
  }, []);

  const handleOAuthCallback = async (code: string, state: string, provider: 'google' | 'microsoft') => {
    setProcessingCallback(true);
    console.log(`🔄 Processing ${provider} OAuth callback...`);
    
    try {
      const stateData = JSON.parse(state);
      const profileId = stateData.profileId;
      
      console.log(`📞 Calling ${provider}-calendar-oauth function...`);
      const { data, error } = await supabase.functions.invoke(`${provider}-calendar-oauth`, {
        body: {
          action: 'callback',
          code,
          state,
          profileId
        }
      });

      if (error) {
        console.error(`❌ OAuth function error:`, error);
        throw error;
      }

      console.log(`✅ OAuth callback successful:`, { 
        success: data.success, 
        calendarsCount: data.calendars?.length,
        provider 
      });

      if (data.success && data.calendars) {
        const modalData = {
          calendars: data.calendars,
          tokens: data.tokens,
          integrationType: provider,
          profileId: data.profileId || profileId
        };
        
        console.log(`📋 Setting modal data and opening modal with ${data.calendars.length} calendars`);
        setCalendarModalData(modalData);
        setCalendarModalOpen(true);
        setPendingSelection(true);
        
        // Use setTimeout to ensure modal opens after state updates
        setTimeout(() => {
          console.log(`🔔 Modal should now be visible - calendarModalOpen: true, calendarModalData exists: ${!!modalData}`);
          toast({
            title: '✓ Step 1 Complete',
            description: `Found ${data.calendars.length} calendar(s). Now SELECT A CALENDAR and click "Connect Calendar" to finish.`,
            duration: 15000,
          });
        }, 100);
      }
    } catch (error: any) {
      console.error('❌ OAuth callback error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to process calendar connection',
        variant: 'destructive'
      });
    } finally {
      setProcessingCallback(false);
      setConnectingProvider(null);
    }
  };

  const fetchUserData = async () => {
    try {
      // Fetch current user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      
      if (profileData.role !== 'parent') {
        toast({
          title: 'Access Denied',
          description: 'You must be a parent to access calendar settings.',
          variant: 'destructive'
        });
        return;
      }

      setProfile(profileData);

      // Fetch family members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      setFamilyMembers(membersData || []);

      // Fetch calendar integrations using the metadata function that includes profile_id
      const { data: integrationsData, error: integrationsError } = await supabase
        .rpc('get_calendar_integrations_metadata');

      if (integrationsError) {
        console.error('Error fetching calendar integrations:', integrationsError);
        setIntegrations([]);
      } else {
        // The metadata function returns integrations with profile_id included
        setIntegrations(integrationsData || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectCalendar = async (memberId: string, integrationType: 'google' | 'microsoft') => {
    setConnectingProvider(`${memberId}-${integrationType}`);
    try {
      // Call OAuth start endpoint (auth is handled automatically by SDK)
      const functionName = integrationType === 'google' ? 'google-calendar-oauth' : 'microsoft-calendar-oauth';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { action: 'start', profileId: memberId },
      });

      if (error) throw error;

      if (data.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('OAuth error details:', {
        message: error.message,
        error: error,
        provider: integrationType,
        memberId: memberId
      });
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect calendar. Please check console for details.',
        variant: 'destructive',
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleSyncNow = async (integrationId: string) => {
    try {
      toast({
        title: 'Syncing...',
        description: 'Starting calendar sync',
      });

      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { integrationId },
      });

      // Check for function errors or data with error property
      if (error) {
        throw new Error(error.message || 'Failed to sync calendar');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Sync complete',
        description: `Synced ${data.eventCount} events`,
      });

      fetchUserData();
    } catch (error: any) {
      console.error('Sync error:', error);
      
      // Check if this is a legacy token error
      const errorMessage = error.message || 'Failed to sync calendar';
      const isLegacyError = errorMessage.includes('outdated') || errorMessage.includes('reconnect');
      
      toast({
        title: isLegacyError ? 'Legacy Connection Detected' : 'Sync failed',
        description: isLegacyError 
          ? 'This calendar uses an outdated connection format. Please disconnect and reconnect it below.'
          : errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!deletingIntegration) return;

    try {
      const { error } = await supabase.rpc('delete_calendar_integration_secure', {
        integration_id_param: deletingIntegration.id
      });

      if (error) throw error;

      toast({
        title: 'Calendar Disconnected',
        description: 'Calendar integration has been removed successfully.',
      });

      setDeletingIntegration(null);
      fetchUserData();
    } catch (error: any) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect calendar',
        variant: 'destructive',
      });
    }
  };

  const handleToggleIntegration = async (integrationId: string, isActive: boolean) => {
    try {
      // Note: Toggle functionality needs to be implemented as a secure function
      // For now, show a warning that direct table updates are not allowed
      toast({
        title: 'Security Update Required',
        description: 'Calendar integration management has been updated for security. Please contact support to toggle integrations.',
        variant: 'destructive',
      });
      return;

      toast({
        title: isActive ? 'Integration Enabled' : 'Integration Disabled',
        description: `Calendar sync has been ${isActive ? 'enabled' : 'disabled'}.`,
      });

      fetchUserData();
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to update integration status',
        variant: 'destructive',
      });
    }
  };

  if (loading || processingCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium">
            {processingCallback ? 'Processing calendar connection...' : 'Loading calendar settings...'}
          </div>
          {processingCallback && (
            <div className="text-sm text-muted-foreground">
              Please wait while we retrieve your calendars
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'parent') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-semibold">Access Denied</div>
              <p className="text-muted-foreground mt-2">
                You must be a parent to access calendar settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Calendar Sync</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Connect and sync external calendars for your family members
        </p>
      </div>

      {/* Integration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            External Calendar Integration
          </CardTitle>
          <CardDescription>
            Connect your family's calendars to sync events and tasks automatically. 
            Each member can manage their own calendar connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Integration Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {integrations.filter(i => i.integration_type === 'google').length}
                </div>
                <div className="text-sm text-muted-foreground">Google Calendar</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {integrations.filter(i => i.integration_type === 'microsoft').length}
                </div>
                <div className="text-sm text-muted-foreground">Outlook Calendar</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {integrations.filter(i => i.is_active).length}
                </div>
                <div className="text-sm text-muted-foreground">Active Connections</div>
              </div>
            </div>

            {/* Family Member Connections */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Family Member Calendars</h3>
               <div className="grid gap-4">
                  {familyMembers.map((member) => {
                   const memberIntegrations = integrations.filter(i => i.profile_id === member.id);
                   const googleIntegration = memberIntegrations.find(i => i.integration_type === 'google');
                   const outlookIntegration = memberIntegrations.find(i => i.integration_type === 'microsoft');

                  return (
                    <Card key={member.id} className="overflow-hidden">
                       <CardContent className="p-4 sm:p-6">
                         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                           <div className="flex items-center gap-3">
                              <UserAvatar
                                name={member.display_name}
                                color={member.color}
                                avatarIcon={member.avatar_url || undefined}
                                size="md"
                              />
                            <div>
                              <div className="font-medium">{member.display_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {member.role} • {memberIntegrations.length} calendar{memberIntegrations.length !== 1 ? 's' : ''} connected
                              </div>
                            </div>
                          </div>
                          <Badge variant={memberIntegrations.some(i => i.is_active) ? "default" : "secondary"}>
                            {memberIntegrations.some(i => i.is_active) ? "Active" : "Inactive"}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          {/* Google Calendar */}
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">Google Calendar</div>
                                <div className="text-sm text-muted-foreground">
                                  {googleIntegration 
                                    ? `Connected on ${format(new Date(googleIntegration.created_at), 'MMM d, yyyy')}`
                                    : 'Not connected'
                                  }
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {googleIntegration && (
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`google-${member.id}`} className="text-sm">
                                    Sync
                                  </Label>
                                  <Switch
                                    id={`google-${member.id}`}
                                    checked={googleIntegration.is_active}
                                    onCheckedChange={(checked) => 
                                      handleToggleIntegration(googleIntegration.id, checked)
                                    }
                                  />
                                </div>
                              )}
                                {googleIntegration ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="bg-green-600">
                                    Connected
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSyncNow(googleIntegration.id)}
                                    disabled={!!connectingProvider}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Sync
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeletingIntegration(googleIntegration)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                   </Button>
                                  </div>
                              ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                  onClick={() => handleConnectCalendar(member.id, 'google')}
                                  disabled={connectingProvider === `${member.id}-google`}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  {connectingProvider === `${member.id}-google` ? 'Connecting...' : 'Connect'}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Outlook Calendar */}
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-orange-600" />
                              </div>
                              <div>
                                <div className="font-medium">Outlook Calendar</div>
                                <div className="text-sm text-muted-foreground">
                                  {outlookIntegration 
                                    ? `Connected on ${format(new Date(outlookIntegration.created_at), 'MMM d, yyyy')}`
                                    : 'Not connected'
                                  }
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {outlookIntegration && (
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`outlook-${member.id}`} className="text-sm">
                                    Sync
                                  </Label>
                                  <Switch
                                    id={`outlook-${member.id}`}
                                    checked={outlookIntegration.is_active}
                                    onCheckedChange={(checked) => 
                                      handleToggleIntegration(outlookIntegration.id, checked)
                                    }
                                  />
                                </div>
                              )}
                               {outlookIntegration ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-600">
                                      Connected
                                    </Badge>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSyncNow(outlookIntegration.id)}
                                      disabled={!!connectingProvider}
                                    >
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                      Sync
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setDeletingIntegration(outlookIntegration)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleConnectCalendar(member.id, 'microsoft')}
                                    disabled={connectingProvider === `${member.id}-microsoft`}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    {connectingProvider === `${member.id}-microsoft` ? 'Connecting...' : 'Connect'}
                                  </Button>
                                )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Sync Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Sync Settings
                </CardTitle>
                <CardDescription>
                  Configure how Family Organiser syncs with external calendars
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Two-way Sync</div>
                      <div className="text-sm text-muted-foreground">
                        Changes in external calendars will update Family Organiser and vice versa
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Sync Tasks as Events</div>
                      <div className="text-sm text-muted-foreground">
                        Family tasks will appear as calendar events in external calendars
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Real-time Sync</div>
                      <div className="text-sm text-muted-foreground">
                        Sync changes immediately instead of on a schedule
                      </div>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Encryption Fix Notice - Only show if there are integrations */}
      {integrations.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <Shield className="h-5 w-5" />
              Calendar Encryption Update
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-200">
              Your calendar tokens have been updated to use a new, more secure encryption system. 
              Existing connections need to be removed and reconnected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>What happened:</strong> We fixed a critical security issue in how calendar tokens were encrypted. 
                Old tokens cannot be decrypted with the new system.
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>What to do:</strong> Click the button below to remove broken connections, then reconnect your calendars 
                using the Google or Outlook buttons above. Your calendar data is safe - only the connection needs to be re-established.
              </p>
            </div>
            <Button
              onClick={async () => {
                try {
                  const { data, error } = await supabase.rpc('cleanup_broken_calendar_integrations');
                  
                  if (error) throw error;
                  
                  const result = data as { success: boolean; deleted_count: number; message: string };
                  
                  toast({
                    title: 'Cleanup Complete',
                    description: result?.message || `Removed ${result?.deleted_count || 0} broken connection(s). You can now reconnect your calendars.`,
                  });
                  
                  fetchUserData();
                } catch (error: any) {
                  console.error('Cleanup error:', error);
                  toast({
                    title: 'Cleanup Failed',
                    description: error.message || 'Failed to clean up connections',
                    variant: 'destructive',
                  });
                }
              }}
              className="w-full sm:w-auto"
              variant="default"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Broken Connections & Prepare for Reconnection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Token Security Management */}
      <TokenSecurityManager />

      {/* Security Monitoring Section */}
      <CalendarSecurityMonitor />

      {/* Delete Integration Dialog */}
      <AlertDialog 
        open={deletingIntegration !== null} 
        onOpenChange={(open) => !open && setDeletingIntegration(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this {deletingIntegration?.integration_type} calendar? 
              This will stop syncing events and tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnectCalendar}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Legacy Integration Warning */}
      {legacyStatus?.needs_migration && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Calendar Connections Outdated</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              Your calendar connections were created with an old encryption method and need to be updated. 
              You have {legacyStatus.legacy_integrations} connection(s) that need to be reconnected.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={handleRemoveLegacyIntegrations} 
                disabled={cleaningLegacy}
                size="sm"
              >
                {cleaningLegacy ? 'Removing...' : 'Remove Old Connections'}
              </Button>
              <p className="text-sm self-center">
                Then reconnect your calendars below
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Token Security Status */}
      <TokenEncryptionStatus />

      {/* Pending Selection Warning */}
      {pendingSelection && !calendarModalOpen && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                  Calendar Setup Incomplete
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                  You started connecting a calendar but didn't complete the setup. 
                  Please select a calendar to finish the connection.
                </p>
              </div>
              <Button 
                onClick={() => setCalendarModalOpen(true)}
                variant="default"
              >
                Complete Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Selection Modal */}
      {calendarModalData && (
        <CalendarSelectionModal
          open={calendarModalOpen}
          onOpenChange={(open) => {
            setCalendarModalOpen(open);
            if (!open) {
              // User closed modal without selecting - keep warning visible
              console.log('⚠️ Modal closed without completing calendar selection');
            }
          }}
          calendars={calendarModalData.calendars}
          tokens={calendarModalData.tokens}
          integrationType={calendarModalData.integrationType}
          profileId={calendarModalData.profileId}
          onSuccess={() => {
            console.log('✅ Calendar integration saved successfully');
            setPendingSelection(false);
            fetchUserData();
            setCalendarModalData(null);
          }}
        />
      )}
    </div>
  );
};

export default CalendarSettings;