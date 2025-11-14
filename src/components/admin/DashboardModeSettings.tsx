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
}

export const DashboardModeSettings = React.memo(() => {
  const { profile } = useAdminContext();
  const [settings, setSettings] = useState<DashboardSettings>({
    dashboard_mode_enabled: false,
    auto_return_enabled: true,
    auto_return_timeout_minutes: 10,
    require_parent_pin_for_dashboard: false
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
        .select('dashboard_mode_enabled, auto_return_enabled, auto_return_timeout_minutes, require_parent_pin_for_dashboard')
        .eq('family_id', profile.family_id)
        .single();

      if (data) {
        setSettings({
          dashboard_mode_enabled: data.dashboard_mode_enabled || false,
          auto_return_enabled: data.auto_return_enabled !== false,
          auto_return_timeout_minutes: data.auto_return_timeout_minutes || 10,
          require_parent_pin_for_dashboard: data.require_parent_pin_for_dashboard || false
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
          require_parent_pin_for_dashboard: settings.require_parent_pin_for_dashboard
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