import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminContext } from '@/contexts/AdminContext';
import { Smartphone, Shield, Timer, Users, Settings2 } from 'lucide-react';

interface DashboardSettings {
  dashboard_mode_enabled: boolean;
  auto_return_timeout_minutes: number;
}

export const DashboardModeSettings = React.memo(() => {
  const { familyMembers, profile, refreshFamilyMembers } = useAdminContext();
  const [settings, setSettings] = useState<DashboardSettings>({
    dashboard_mode_enabled: false,
    auto_return_timeout_minutes: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.family_id) {
      loadSettings();
    }
  }, [profile?.family_id]);

  const loadSettings = async () => {
    if (!profile?.family_id) return;
    
    try {
      const { data, error } = await supabase
        .from('household_settings')
        .select('dashboard_mode_enabled, auto_return_timeout_minutes')
        .eq('family_id', profile.family_id)
        .single();

      if (data) {
        setSettings({
          dashboard_mode_enabled: data.dashboard_mode_enabled || false,
          auto_return_timeout_minutes: data.auto_return_timeout_minutes || 10
        });
      }
    } catch (error) {
      console.error('Error loading dashboard settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!profile?.family_id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('household_settings')
        .upsert({
          family_id: profile.family_id,
          dashboard_mode_enabled: settings.dashboard_mode_enabled,
          auto_return_timeout_minutes: settings.auto_return_timeout_minutes
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Dashboard mode settings have been updated.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateMemberPermissions = async (memberId: string, field: string, value: boolean | string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', memberId);

      if (error) throw error;

      await refreshFamilyMembers();
      
      toast({
        title: "Permissions Updated",
        description: "Member permissions have been saved.",
      });
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast({
        title: "Error",
        description: "Failed to update permissions. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dashboard Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading dashboard settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Dashboard Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dashboard Mode Settings
          </CardTitle>
          <CardDescription>
            Configure shared device access and identity switching for family members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Dashboard Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Enable Dashboard Mode</Label>
              <p className="text-sm text-muted-foreground">
                Allow family members to switch identities and complete tasks as different members
              </p>
            </div>
            <Switch
              checked={settings.dashboard_mode_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, dashboard_mode_enabled: checked }))
              }
            />
          </div>

          {/* Auto Return Timeout */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              <Label className="text-base font-medium">Auto Return Timeout</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Minutes of inactivity before returning to main dashboard view
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="60"
                value={settings.auto_return_timeout_minutes}
                onChange={(e) => 
                  setSettings(prev => ({ 
                    ...prev, 
                    auto_return_timeout_minutes: parseInt(e.target.value) || 10 
                  }))
                }
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Member Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Member Permissions
          </CardTitle>
          <CardDescription>
            Configure PIN requirements and permissions for each family member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar 
                    name={member.display_name} 
                    color={member.color} 
                    size="sm" 
                  />
                  <div className="flex-1">
                    <div className="font-medium">{member.display_name}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'parent' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      {member.pin_hash && (
                        <Badge variant="outline" className="text-xs">
                          PIN Set
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Task Completion PIN */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Require PIN for Task Completion</Label>
                      <p className="text-xs text-muted-foreground">
                        Member must enter PIN to complete tasks
                      </p>
                    </div>
                    <Switch
                      checked={member.require_pin_to_complete_tasks || false}
                      onCheckedChange={(checked) => 
                        updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', checked)
                      }
                    />
                  </div>

                  {/* List Deletion PIN */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Require PIN for List Deletions</Label>
                      <p className="text-xs text-muted-foreground">
                        Member must enter PIN for destructive list actions
                      </p>
                    </div>
                    <Switch
                      checked={member.require_pin_for_list_deletes || false}
                      onCheckedChange={(checked) => 
                        updateMemberPermissions(member.id, 'require_pin_for_list_deletes', checked)
                      }
                    />
                  </div>
                </div>

                {/* Calendar Edit Permission */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Calendar Edit Permission</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={member.calendar_edit_permission === 'open' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateMemberPermissions(member.id, 'calendar_edit_permission', 'open')}
                    >
                      Open Access
                    </Button>
                    <Button
                      variant={member.calendar_edit_permission === 'require_pin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateMemberPermissions(member.id, 'calendar_edit_permission', 'require_pin')}
                    >
                      Require PIN
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permission Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Permission Presets
          </CardTitle>
          <CardDescription>
            Quick configuration templates for common household setups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Open Household</CardTitle>
                <CardDescription className="text-xs">
                  No PIN requirements, everyone can do everything
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    // Apply open preset to all members
                    familyMembers.forEach(member => {
                      updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', false);
                      updateMemberPermissions(member.id, 'require_pin_for_list_deletes', false);
                      updateMemberPermissions(member.id, 'calendar_edit_permission', 'open');
                    });
                  }}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Guided</CardTitle>
                <CardDescription className="text-xs">
                  PINs required for task completion, open for lists/calendar
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    // Apply guided preset to all members
                    familyMembers.forEach(member => {
                      updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', true);
                      updateMemberPermissions(member.id, 'require_pin_for_list_deletes', false);
                      updateMemberPermissions(member.id, 'calendar_edit_permission', 'open');
                    });
                  }}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Locked</CardTitle>
                <CardDescription className="text-xs">
                  PINs required for all actions to prevent accidental changes
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    // Apply locked preset to all members
                    familyMembers.forEach(member => {
                      updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', true);
                      updateMemberPermissions(member.id, 'require_pin_for_list_deletes', true);
                      updateMemberPermissions(member.id, 'calendar_edit_permission', 'require_pin');
                    });
                  }}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});