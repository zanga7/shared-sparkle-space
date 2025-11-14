import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const availableRegions = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺', subdivisions: [
    { code: 'AU-NSW', name: 'New South Wales' },
    { code: 'AU-VIC', name: 'Victoria' },
    { code: 'AU-QLD', name: 'Queensland' },
    { code: 'AU-WA', name: 'Western Australia' },
    { code: 'AU-SA', name: 'South Australia' },
    { code: 'AU-TAS', name: 'Tasmania' },
    { code: 'AU-ACT', name: 'Australian Capital Territory' },
    { code: 'AU-NT', name: 'Northern Territory' },
  ]},
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', subdivisions: [] },
  { code: 'US', name: 'United States', flag: '🇺🇸', subdivisions: [] },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', subdivisions: [] },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', subdivisions: [] },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', subdivisions: [] },
];

interface PublicHolidaySettingsProps {
  familyId: string;
}

export const PublicHolidaySettings = ({ familyId }: PublicHolidaySettingsProps) => {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['public-holiday-settings', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_holiday_settings')
        .select('*')
        .eq('family_id', familyId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!settings) {
        const { data, error } = await supabase
          .from('public_holiday_settings')
          .insert({
            family_id: familyId,
            api_provider: 'nager',
            ...updates,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('public_holiday_settings')
          .update(updates)
          .eq('id', settings.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-holiday-settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });

  const toggleRegion = (regionCode: string) => {
    const currentRegions = (settings?.enabled_regions as string[]) || [];
    const newRegions = currentRegions.includes(regionCode)
      ? currentRegions.filter((r: string) => r !== regionCode)
      : [...currentRegions, regionCode];
    updateMutation.mutate({ enabled_regions: newRegions });
  };

  const syncHolidays = async () => {
    setSyncing(true);
    const currentYear = new Date().getFullYear();
    const regions = (settings?.enabled_regions as string[]) || [];

    try {
      for (const region of regions) {
        const { error } = await supabase.functions.invoke('sync-public-holidays', {
          body: { region_code: region, year: currentYear },
        });
        if (error) throw error;
      }
      
      await updateMutation.mutateAsync({ last_sync_at: new Date().toISOString() });
      toast.success('Holidays synced successfully');
    } catch (error: any) {
      toast.error('Failed to sync holidays: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledRegions = (settings?.enabled_regions as string[]) || [];

  return (
    <Card>
      <CardHeader className="grid-card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Public Holidays
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select regions to display their public holidays on your calendar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="holiday-enabled">Enable</Label>
            <Switch
              id="holiday-enabled"
              checked={settings?.is_enabled ?? false}
              onCheckedChange={(checked) => updateMutation.mutate({ is_enabled: checked })}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid-card-content">
        <div className="space-y-6">
          {/* Region selection */}
          <div className="space-y-4">
            {availableRegions.map((region) => (
              <div key={region.code} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={region.code}
                    checked={enabledRegions.includes(region.code)}
                    onCheckedChange={() => toggleRegion(region.code)}
                  />
                  <Label htmlFor={region.code} className="flex items-center gap-2 cursor-pointer">
                    <span className="text-lg">{region.flag}</span>
                    <span>{region.name}</span>
                  </Label>
                </div>

                {region.subdivisions.length > 0 && enabledRegions.includes(region.code) && (
                  <div className="ml-8 space-y-2">
                    {region.subdivisions.map((sub) => (
                      <div key={sub.code} className="flex items-center gap-2">
                        <Checkbox
                          id={sub.code}
                          checked={enabledRegions.includes(sub.code)}
                          onCheckedChange={() => toggleRegion(sub.code)}
                        />
                        <Label htmlFor={sub.code} className="text-sm cursor-pointer">
                          {sub.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sync status */}
          {settings && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Last Synced</p>
                <p className="text-xs text-muted-foreground">
                  {settings.last_sync_at
                    ? format(new Date(settings.last_sync_at), 'PPp')
                    : 'Never synced'}
                </p>
                <Badge variant="outline" className="text-xs">
                  API: {settings.api_provider}
                </Badge>
              </div>
              <Button
                onClick={syncHolidays}
                disabled={syncing || !settings.is_enabled || enabledRegions.length === 0}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
