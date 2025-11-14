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
import { Loader2, RefreshCw, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { AddCustomRegionDialog } from './AddCustomRegionDialog';

const defaultRegions = [
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
  const [addRegionDialogOpen, setAddRegionDialogOpen] = useState(false);
  const [customRegions, setCustomRegions] = useState<Array<{ code: string; name: string; flag: string; subdivisions: any[] }>>([]);
  const queryClient = useQueryClient();

  const availableRegions = [...defaultRegions, ...customRegions];

  const { data: settings, isLoading } = useQuery({
    queryKey: ['public-holiday-settings', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_holiday_settings' as any)
        .select('*')
        .eq('family_id', familyId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as any;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!settings) {
        const { data, error } = await supabase
          .from('public_holiday_settings' as any)
          .insert({ family_id: familyId, api_provider: 'nager', ...updates })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('public_holiday_settings' as any)
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
      toast.success('Settings updated');
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
    try {
      const regions = (settings?.enabled_regions as string[]) || [];
      for (const region of regions) {
        await supabase.functions.invoke('sync-public-holidays', {
          body: { region_code: region, year: new Date().getFullYear() },
        });
      }
      await updateMutation.mutateAsync({ last_sync_at: new Date().toISOString() });
      toast.success('Holidays synced');
    } catch (error: any) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const enabledRegions = (settings?.enabled_regions as string[]) || [];

  return (
    <>
      <Card>
        <CardHeader className="grid-card-header">
          <div className="flex items-center gap-2">
            <Label>Enable Public Holidays</Label>
            <Switch checked={settings?.is_enabled ?? false} onCheckedChange={(checked) => updateMutation.mutate({ is_enabled: checked })} />
          </div>
        </CardHeader>
        <CardContent className="grid-card-content">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Select Regions</h3>
                <Button variant="outline" size="sm" onClick={() => setAddRegionDialogOpen(true)}><Plus className="h-3 w-3 mr-1" />Add Region</Button>
              </div>
              <div className="space-y-4">
                {availableRegions.map((region) => (
                  <div key={region.code} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id={region.code} checked={enabledRegions.includes(region.code)} onCheckedChange={() => toggleRegion(region.code)} />
                      <Label htmlFor={region.code} className="flex items-center gap-2 cursor-pointer">
                        <span>{region.flag}</span>
                        <span>{region.name}</span>
                      </Label>
                    </div>
                    {region.subdivisions.length > 0 && enabledRegions.includes(region.code) && (
                      <div className="ml-8 space-y-2">
                        {region.subdivisions.map((sub) => (
                          <div key={sub.code} className="flex items-center gap-2">
                            <Checkbox id={sub.code} checked={enabledRegions.includes(sub.code)} onCheckedChange={() => toggleRegion(sub.code)} />
                            <Label htmlFor={sub.code} className="text-sm cursor-pointer">{sub.name}</Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {settings && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Last Synced</p>
                  <p className="text-xs text-muted-foreground">{settings.last_sync_at ? format(new Date(settings.last_sync_at), 'PPp') : 'Never'}</p>
                  <Badge variant="outline" className="text-xs">API: {settings.api_provider}</Badge>
                </div>
                <Button onClick={syncHolidays} disabled={syncing || !settings.is_enabled || enabledRegions.length === 0}>
                  {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync Now
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <AddCustomRegionDialog open={addRegionDialogOpen} onOpenChange={setAddRegionDialogOpen} onAdd={(r) => { setCustomRegions(prev => [...prev, { ...r, subdivisions: [] }]); toast.success(`Added ${r.name}`); }} />
    </>
  );
};
