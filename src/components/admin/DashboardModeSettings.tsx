import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminContext } from '@/contexts/AdminContext';
import { Smartphone, Timer } from 'lucide-react';

interface DashboardSettings {
  dashboard_mode_enabled: boolean;
  auto_return_enabled: boolean;
  auto_return_timeout_minutes: number;
  require_parent_pin_for_dashboard: boolean;
  completed_tasks_hide_hours: number;
}

export const DashboardModeSettings = React.memo(() => {
  const { profile } = useAdminContext();
  const [settings, setSettings] = useState<DashboardSettings>({
    dashboard_mode_enabled: false,
    auto_return_enabled: true,
    auto_return_timeout_minutes: 10,
    require_parent_pin_for_dashboard: false,
    completed_tasks_hide_hours: 12
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
        .select('dashboard_mode_enabled, auto_return_enabled, auto_return_timeout_minutes, require_parent_pin_for_dashboard, completed_tasks_hide_hours')
        .eq('family_id', profile.family_id)
        .single();

      if (error) {
        console.error('Error loading settings:', error);
      }

      if (data) {
        setSettings({
          dashboard_mode_enabled: (data as any).dashboard_mode_enabled || false,
          auto_return_enabled: (data as any).auto_return_enabled !== false,
          auto_return_timeout_minutes: (data as any).auto_return_timeout_minutes || 10,
          require_parent_pin_for_dashboard: (data as any).require_parent_pin_for_dashboard || false,
          completed_tasks_hide_hours: (data as any).completed_tasks_hide_hours || 12
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
          auto_return_enabled: settings.auto_return_enabled,
          auto_return_timeout_minutes: settings.auto_return_timeout_minutes,
          require_parent_pin_for_dashboard: settings.require_parent_pin_for_dashboard,
          completed_tasks_hide_hours: settings.completed_tasks_hide_hours
        }, {
          onConflict: 'family_id'
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

          {/* Parent PIN Requirement */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Require Parent PIN to Access Dashboard</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, users must enter a parent PIN to access the dashboard
              </p>
            </div>
            <Switch
              checked={settings.require_parent_pin_for_dashboard}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, require_parent_pin_for_dashboard: checked }))
              }
            />
          </div>

          {/* Auto Return Timeout */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <Label className="text-base font-medium">Auto Return Timeout</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically return to main dashboard after inactivity
                </p>
              </div>
              <Switch
                checked={settings.auto_return_enabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, auto_return_enabled: checked }))
                }
              />
            </div>
            
            {settings.auto_return_enabled && (
              <div className="pl-6 space-y-2">
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
            )}
          </div>

          {/* Completed Tasks Hide Setting */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-1">
              <Label className="text-base font-medium">Completed Tasks Auto-Hide</Label>
              <p className="text-sm text-muted-foreground">
                Automatically hide completed tasks after a specified time period
              </p>
            </div>
            
            <div className="pl-6 space-y-2">
              <Label htmlFor="completed-tasks-hide-hours">Hours After Completion</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="completed-tasks-hide-hours"
                  type="number"
                  min="1"
                  max="168"
                  value={settings.completed_tasks_hide_hours}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    completed_tasks_hide_hours: parseInt(e.target.value) || 12
                  })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tasks will be hidden {settings.completed_tasks_hide_hours} hour{settings.completed_tasks_hide_hours !== 1 ? 's' : ''} after completion (Default: 12 hours)
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
});