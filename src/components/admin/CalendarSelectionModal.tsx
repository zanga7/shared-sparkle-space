import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Calendar {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
}

interface CalendarSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: Calendar[];
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  integrationType: 'google' | 'microsoft';
  profileId: string;
  onSuccess: () => void;
}

export const CalendarSelectionModal = ({
  open,
  onOpenChange,
  calendars,
  tokens,
  integrationType,
  profileId,
  onSuccess,
}: CalendarSelectionModalProps) => {
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    calendars.find((c) => c.primary)?.id || calendars[0]?.id || ''
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    console.log(`🎯 handleConnect called - selectedCalendarId: ${selectedCalendarId}`);
    
    if (!selectedCalendarId) {
      console.warn('❌ No calendar selected');
      toast({
        title: 'No calendar selected',
        description: 'Please select a calendar to sync',
        variant: 'destructive',
      });
      return;
    }

    console.log(`🔗 Connecting calendar: ${selectedCalendarId} (${integrationType}) for profile: ${profileId}`);
    setLoading(true);
    
    try {
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      console.log('💾 Calling create_secure_calendar_integration RPC with params:', { 
        integration_type_param: integrationType,
        calendar_id_param: selectedCalendarId,
        expires_at_param: expiresAt,
        target_profile_id_param: profileId,
        has_access_token: !!tokens.access_token,
        has_refresh_token: !!tokens.refresh_token
      });
      
      const { data, error } = await supabase.rpc('create_secure_calendar_integration', {
        integration_type_param: integrationType,
        calendar_id_param: selectedCalendarId,
        access_token_param: tokens.access_token,
        refresh_token_param: tokens.refresh_token || null,
        expires_at_param: expiresAt,
        target_profile_id_param: profileId,
      });

      console.log('📡 RPC Response:', { data, error });

      if (error) {
        console.error('❌ RPC error:', error);
        throw error;
      }

      // Check if the RPC returned a success response
      const result = data as any;
      if (result && !result.success) {
        console.error('❌ RPC returned error:', result.error);
        throw new Error(result.error || 'Failed to create integration');
      }

      console.log('✅ Calendar integration created successfully:', data);

      // Register webhook watch channel for real-time sync
      const integrationResult = result as any;
      const newIntegrationId = integrationResult?.integration_id;
      if (newIntegrationId) {
        try {
          console.log('📡 Registering webhook watch for integration:', newIntegrationId);
          const { error: watchError } = await supabase.functions.invoke('register-calendar-watch', {
            body: { integrationId: newIntegrationId },
          });
          if (watchError) {
            console.warn('⚠️ Watch registration failed (sync will still work manually):', watchError);
          } else {
            console.log('✅ Webhook watch registered - real-time sync enabled');
          }
        } catch (watchErr) {
          console.warn('⚠️ Watch registration failed:', watchErr);
        }
      }

      toast({
        title: '✓ Calendar Connected',
        description: `Successfully connected to ${integrationType === 'google' ? 'Google' : 'Microsoft'} Calendar`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('❌ Error connecting calendar:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect calendar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(open) => {
        // Prevent closing by clicking outside or escape key during loading
        if (!open && loading) {
          console.log('🚫 Cannot close modal while connecting...');
          return;
        }
        onOpenChange(open);
      }}
    >
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          // Prevent closing modal by clicking outside - force user to use buttons
          e.preventDefault();
          console.log('⚠️ Please use the buttons to complete or cancel setup');
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with escape key during loading
          if (loading) {
            e.preventDefault();
            console.log('🚫 Cannot close modal while connecting...');
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Select Calendar to Connect</DialogTitle>
          <DialogDescription>
            Choose which {integrationType === 'google' ? 'Google' : 'Microsoft'} calendar you want to sync. 
            <span className="block mt-1 font-medium text-foreground">Important: Click "Connect Calendar" below to complete setup.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
            <div className="space-y-3">
              {calendars.map((calendar) => (
                <div
                  key={calendar.id}
                  className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-accent/50 cursor-pointer"
                  onClick={() => setSelectedCalendarId(calendar.id)}
                >
                  <RadioGroupItem value={calendar.id} id={calendar.id} />
                  <Label
                    htmlFor={calendar.id}
                    className="flex-1 cursor-pointer flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{calendar.summary}</span>
                    {calendar.primary && (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    {calendar.accessRole}
                  </Badge>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              console.log('⚠️ User cancelled calendar selection');
              toast({
                title: 'Setup Cancelled',
                description: 'Calendar connection was not completed.',
                variant: 'destructive',
              });
              onOpenChange(false);
            }} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConnect} 
            disabled={loading || !selectedCalendarId}
            className="min-w-[150px]"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Connect Calendar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
