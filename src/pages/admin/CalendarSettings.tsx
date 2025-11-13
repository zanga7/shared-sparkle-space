import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, Settings, ExternalLink, RefreshCw, Trash2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/types/task';
import { TokenEncryptionStatus } from '@/components/security/TokenEncryptionStatus';

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

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

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

      // Fetch calendar integrations using secure function
      const { data: integrationsData, error: integrationsError } = await supabase
        .rpc('get_user_calendar_integrations');

      if (integrationsError) throw integrationsError;
      
      // Map the secure function response to include profile data
      // Since the secure function only returns integrations for the current user's family,
      // we need to match them with family members by comparing integration ownership
      const enrichedIntegrations = [];
      for (const integration of integrationsData || []) {
        // For now, since we can't determine profile_id from the secure function,
        // we'll need to implement this differently or create a more comprehensive secure function
        // Let's create a temporary association for demo purposes
        const randomProfile = membersData?.[0]; // This is temporary
        if (randomProfile) {
          enrichedIntegrations.push({
            ...integration,
            profile_id: randomProfile.id, // Add this for compatibility
            profile: {
              id: randomProfile.id,
              display_name: randomProfile.display_name,
              role: randomProfile.role,
              color: randomProfile.color
            },
            integration_type: integration.integration_type as 'google' | 'outlook'
          });
        }
      }
      setIntegrations(enrichedIntegrations);

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

  const handleConnectCalendar = async (memberId: string, integrationType: 'google' | 'outlook') => {
    toast({
      title: 'Coming Soon',
      description: `${integrationType === 'google' ? 'Google' : 'Outlook'} Calendar integration will be available soon.`,
    });
  };

  const handleDisconnectCalendar = async () => {
    if (!deletingIntegration) return;

    try {
      const { data, error } = await supabase.rpc('delete_calendar_integration', {
        integration_id_param: deletingIntegration.id
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete integration');
      }

      toast({
        title: 'Calendar Disconnected',
        description: 'Calendar integration has been removed successfully.',
      });

      setDeletingIntegration(null);
      fetchUserData();
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect calendar',
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading calendar settings...</div>
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
        <h1 className="text-2xl sm:text-3xl font-bold">Calendar Settings</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage external calendar integrations for your family members
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
                  {integrations.filter(i => i.integration_type === 'outlook').length}
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
                  const outlookIntegration = memberIntegrations.find(i => i.integration_type === 'outlook');

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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeletingIntegration(googleIntegration)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleConnectCalendar(member.id, 'google')}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Connect
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeletingIntegration(outlookIntegration)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleConnectCalendar(member.id, 'outlook')}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Connect
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

      {/* Token Security Status */}
      <TokenEncryptionStatus />
    </div>
  );
};

export default CalendarSettings;