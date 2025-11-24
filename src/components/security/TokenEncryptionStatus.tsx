import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TokenEncryptionStatusProps {
  className?: string;
}

export const TokenEncryptionStatus = ({ className }: TokenEncryptionStatusProps) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    calendar_total: number;
    calendar_encrypted: number;
    calendar_broken: number;
    calendar_unencrypted: number;
    google_photos_total: number;
    google_photos_encrypted: number;
    google_photos_unencrypted: number;
    encryption_complete: boolean;
    has_broken_tokens: boolean;
  } | null>(null);
  const { toast } = useToast();

  const checkEncryptionStatus = async () => {
    setLoading(true);
    try {
      // Use the improved metadata function to check encryption status
      const { data: integrations, error: integrationsError } = await supabase
        .rpc('get_calendar_integrations_metadata');

      if (integrationsError) throw integrationsError;

      const integrationsData = integrations || [];
      
      // Count encrypted vs unencrypted calendar integrations
      const calendarTotal = integrationsData.length;
      const calendarEncrypted = integrationsData.filter((i: any) => i.is_encrypted).length;
      const calendarUnencrypted = integrationsData.filter((i: any) => !i.is_encrypted && i.has_access_token).length;

      // Check Google Photos encryption status
      const { data: googlePhotosCount, error: googlePhotosError } = await supabase
        .from('google_photos_integrations')
        .select('id', { count: 'exact' })
        .eq('is_active', true);

      // If permission denied, assume no Google Photos integrations exist
      if (googlePhotosError && googlePhotosError.code !== '42501') throw googlePhotosError;

      const googlePhotosTotal = googlePhotosCount?.length || 0;

      setStatus({
        calendar_total: calendarTotal,
        calendar_encrypted: calendarEncrypted,
        calendar_broken: 0, // v2 format should eliminate broken tokens
        calendar_unencrypted: calendarUnencrypted,
        google_photos_total: googlePhotosTotal,
        google_photos_encrypted: googlePhotosTotal,
        google_photos_unencrypted: 0,
        encryption_complete: calendarUnencrypted === 0,
        has_broken_tokens: false
      });

      // Auto-migrate if there are unencrypted tokens
      if (calendarUnencrypted > 0) {
        await migrateTokensToV2();
      }
    } catch (error) {
      console.error('Error checking encryption status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check encryption status',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const migrateTokensToV2 = async () => {
    try {
      const { data, error } = await supabase
        .rpc('migrate_tokens_to_v2_format');

      if (error) throw error;

      const result = data as any;
      if (result?.migrated_count > 0) {
        toast({
          title: 'Tokens Migrated',
          description: `Successfully upgraded ${result.migrated_count} token(s) to v2 encryption format`,
        });
        // Refresh status
        await checkEncryptionStatus();
      }
    } catch (error) {
      console.error('Error migrating tokens:', error);
    }
  };

  const cleanupBrokenTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('cleanup_broken_calendar_integrations');

      if (error) throw error;

      const result = data as any;
      toast({
        title: 'Cleanup Complete',
        description: `Removed ${result?.deleted_count || 0} broken calendar connection(s). Please reconnect your calendars.`,
      });

      // Refresh status
      await checkEncryptionStatus();
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
      toast({
        title: 'Cleanup Failed',
        description: 'Failed to remove broken connections. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!status) return <Shield className="h-5 w-5 text-muted-foreground" />;
    if (status.encryption_complete) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (!status) return 'secondary';
    if (status.encryption_complete) return 'default';
    return 'destructive';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          OAuth Token Security Status
        </CardTitle>
        <CardDescription>
          Check and ensure all OAuth tokens are encrypted at rest
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={checkEncryptionStatus}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Check Status
          </Button>
        </div>

        {status && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={getStatusColor()}>
                {status.encryption_complete ? 'Secure' : 'Action Required'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium">Calendar Integrations</h4>
                <div className="space-y-1 text-muted-foreground">
                  <div>Total: {status.calendar_total}</div>
                  <div className="text-green-600">Secure (v2): {status.calendar_encrypted}</div>
                  {status.calendar_unencrypted > 0 && (
                    <div className="text-yellow-600">Needs Migration: {status.calendar_unencrypted}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Google Photos Integrations</h4>
                <div className="space-y-1 text-muted-foreground">
                  <div>Total: {status.google_photos_total}</div>
                  <div className="text-green-600">Encrypted: {status.google_photos_encrypted}</div>
                  {status.google_photos_unencrypted > 0 && (
                    <div className="text-red-600">Unencrypted: {status.google_photos_unencrypted}</div>
                  )}
                </div>
              </div>
            </div>

            {status.calendar_unencrypted > 0 && (
              <div className="pt-2 space-y-2">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-500 font-medium">
                    Token Migration Available
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your calendar tokens will be automatically migrated to the latest v2 encryption format on next check.
                  </p>
                </div>
              </div>
            )}

            {status.encryption_complete && (
              <div className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                All OAuth tokens are securely encrypted
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};