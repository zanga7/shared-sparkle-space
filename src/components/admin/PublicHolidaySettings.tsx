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
import { RegionSelector } from './RegionSelector';

interface PublicHolidaySettingsProps {
  familyId: string;
}

export const PublicHolidaySettings = ({ familyId }: PublicHolidaySettingsProps) => {
  const [syncing, setSyncing] = useState(false);
  const [regionSelectorOpen, setRegionSelectorOpen] = useState(false);
  const [savedRegions, setSavedRegions] = useState<Array<{ code: string; name: string; flag: string }>>([]);
  const queryClient = useQueryClient();

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

  const handleSelectRegion = (region: { code: string; name: string; flag: string; isSubdivision?: boolean }) => {
    const currentRegions = (settings?.enabled_regions as string[]) || [];
    
    // If selecting a subdivision, remove the parent country if it exists
    let newRegions = [...currentRegions];
    if (region.isSubdivision) {
      const parentCountry = region.code.split('-')[0];
      newRegions = newRegions.filter((r: string) => r !== parentCountry);
    } else {
      // If selecting a country, remove any subdivisions of that country
      newRegions = newRegions.filter((r: string) => !r.startsWith(region.code + '-'));
    }
    
    // Toggle the region
    if (newRegions.includes(region.code)) {
      newRegions = newRegions.filter((r: string) => r !== region.code);
      setSavedRegions(savedRegions.filter(r => r.code !== region.code));
    } else {
      newRegions.push(region.code);
      setSavedRegions([...savedRegions.filter(r => r.code !== region.code), region]);
    }
    
    updateMutation.mutate({ enabled_regions: newRegions });
  };

  const removeRegion = (regionCode: string) => {
    const currentRegions = (settings?.enabled_regions as string[]) || [];
    const newRegions = currentRegions.filter((r: string) => r !== regionCode);
    updateMutation.mutate({ enabled_regions: newRegions });
    setSavedRegions(savedRegions.filter(r => r.code !== regionCode));
  };

  const syncHolidays = async () => {
    setSyncing(true);
    try {
      const regions = (settings?.enabled_regions as string[]) || [];
      const currentYear = new Date().getFullYear();
      // Sync current year + next 3 years
      const yearsToSync = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
      
      for (const region of regions) {
        for (const year of yearsToSync) {
          await supabase.functions.invoke('sync-public-holidays', {
            body: { region_code: region, year },
          });
        }
      }
      await updateMutation.mutateAsync({ last_sync_at: new Date().toISOString() });
      toast.success('Holidays synced for current and future years');
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
                <Label>Selected Regions</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegionSelectorOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Region
                </Button>
              </div>

              <div className="space-y-2">
                {enabledRegions.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                    No regions selected. Click "Add Region" to get started.
                  </p>
                ) : (
                  enabledRegions.map((regionCode) => {
                    const savedRegion = savedRegions.find(r => r.code === regionCode);
                    const flag = savedRegion?.flag || regionCode.split('-')[0];
                    const name = savedRegion?.name || regionCode;
                    const isSubdivision = regionCode.includes('-');

                    return (
                      <div
                        key={regionCode}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{flag}</span>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {regionCode}
                              {isSubdivision && ' (includes national holidays)'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRegion(regionCode)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })
                )}
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
      
      <RegionSelector
        open={regionSelectorOpen}
        onOpenChange={setRegionSelectorOpen}
        onSelect={handleSelectRegion}
        selectedRegions={enabledRegions}
      />
    </>
  );
};
