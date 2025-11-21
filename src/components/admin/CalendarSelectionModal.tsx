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
import { Calendar, Check } from 'lucide-react';
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
    if (!selectedCalendarId) {
      toast({
        title: 'No calendar selected',
        description: 'Please select a calendar to sync',
        variant: 'destructive',
      });
      return;
    }

    console.log(`🔗 Connecting calendar: ${selectedCalendarId} (${integrationType})`);
    setLoading(true);
    
    try {
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      console.log('💾 Calling create_secure_calendar_integration RPC...');
      const { data, error } = await supabase.rpc('create_secure_calendar_integration', {
        access_token_param: tokens.access_token,
        refresh_token_param: tokens.refresh_token || null,
        calendar_id_param: selectedCalendarId,
        integration_type_param: integrationType,
        expires_at_param: expiresAt,
      });

      if (error) {
        console.error('❌ RPC error:', error);
        throw error;
      }

      console.log('✅ Calendar integration created successfully:', data);

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
    <Dialog open={open} onOpenChange={(open) => {
      // Prevent closing by clicking outside or escape key during loading
      if (!open && loading) {
        return;
      }
      // Warn user if trying to close without completing
      if (!open && !loading) {
        console.log('⚠️ User attempting to close calendar selection modal');
      }
      onOpenChange(open);
    }}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>⚠️ Complete Calendar Setup</DialogTitle>
          <DialogDescription>
            Choose which calendar you want to sync with your family calendar.
            You must select a calendar to complete the connection.
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
              onOpenChange(false);
            }} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConnect} 
            disabled={loading || !selectedCalendarId}
          >
            {loading ? 'Connecting...' : 'Connect Calendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
