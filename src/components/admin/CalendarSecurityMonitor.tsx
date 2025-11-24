import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityAlert {
  alert_type: string;
  alert_message: string;
  integration_id: string;
  severity: string;
  created_at: string;
}

interface SecuritySummary {
  id: string;
  integration_type: string;
  is_active: boolean;
  owner_name: string;
  created_at: string;
  last_token_refresh: string;
  token_refresh_count: number;
  access_count_7_days: number;
  failed_access_count_7_days: number;
  is_encrypted?: boolean;
  last_sync?: string;
}

export const CalendarSecurityMonitor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [summaries, setSummaries] = useState<SecuritySummary[]>([]);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);

      // Fetch security alerts
      const { data: alertsData, error: alertsError } = await supabase
        .rpc('get_calendar_security_alerts');

      if (alertsError) {
        console.error('Error fetching security alerts:', alertsError);
      } else {
        setAlerts(alertsData || []);
      }

      // Fetch integration metadata for better display
      const { data: metadataData, error: metadataError } = await supabase
        .rpc('get_calendar_integrations_metadata');

      if (metadataError) {
        console.error('Error fetching integration metadata:', metadataError);
      }

      // Fetch security summary for audit data
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_calendar_security_summary');

      if (summaryError) {
        console.error('Error fetching security summary:', summaryError);
      }

      // Merge metadata with summary data
      const metadata = metadataData || [];
      const summaries = summaryData || [];

      // Create enhanced summary by combining both
      const enhancedSummaries = metadata.map((meta: any) => {
        const summary = summaries.find((s: any) => s.id === meta.id);
        return {
          id: meta.id,
          integration_type: meta.integration_type,
          is_active: meta.is_active,
          owner_name: 'Family Member', // Profile name would need join
          created_at: meta.created_at,
          last_token_refresh: meta.last_token_refresh,
          token_refresh_count: meta.token_refresh_count || 0,
          access_count_7_days: summary?.access_count_7_days || 0,
          failed_access_count_7_days: summary?.failed_access_count_7_days || 0,
          is_encrypted: meta.is_encrypted,
          last_sync: meta.updated_at
        };
      });

      setSummaries(enhancedSummaries);

    } catch (error) {
      console.error('Error fetching security data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security monitoring data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeIntegration = async (integrationId: string) => {
    try {
      const { error } = await supabase
        .rpc('revoke_calendar_integration', {
          integration_id: integrationId,
          reason: 'admin_security_revocation'
        });

      if (error) throw error;

      toast({
        title: 'Integration Revoked',
        description: 'Calendar integration has been revoked for security reasons',
      });

      fetchSecurityData();
    } catch (error) {
      console.error('Error revoking integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke calendar integration',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchSecurityData();
    }
  }, [user]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'failed_access': return AlertTriangle;
      case 'high_refresh_rate': return RefreshCw;
      default: return Shield;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Loading security data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </CardTitle>
          <CardDescription>
            Recent security events and potential threats
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security alerts</p>
              <p className="text-sm">All calendar integrations are secure</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, index) => {
                const AlertIcon = getAlertIcon(alert.alert_type);
                return (
                  <Alert key={index} variant={getSeverityColor(alert.severity) as any}>
                    <AlertIcon className="h-4 w-4" />
                    <AlertTitle className="flex items-center justify-between">
                      <span>{alert.alert_message}</span>
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm">
                          {format(new Date(alert.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeIntegration(alert.integration_id)}
                        >
                          Revoke Access
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Security Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Integration Security Overview
            </span>
            <Button variant="outline" size="sm" onClick={fetchSecurityData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Security status of all calendar integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p>No calendar integrations configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map((summary) => (
                <div
                  key={summary.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{summary.owner_name}</span>
                      <Badge variant={summary.is_active ? "default" : "secondary"}>
                        {summary.integration_type}
                      </Badge>
                      <Badge variant={summary.is_active ? "default" : "secondary"}>
                        {summary.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {summary.is_encrypted && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          v2 Encrypted
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {format(new Date(summary.created_at), 'MMM d, yyyy')}
                      {summary.last_sync && (
                        <> • Last sync: {format(new Date(summary.last_sync), 'MMM d, yyyy HH:mm')}</>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold">{summary.access_count_7_days}</div>
                      <div className="text-xs text-muted-foreground">Accesses (7d)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{summary.failed_access_count_7_days}</div>
                      <div className="text-xs text-muted-foreground">Failed (7d)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{summary.token_refresh_count}</div>
                      <div className="text-xs text-muted-foreground">Refreshes</div>
                    </div>
                    
                    {(summary.failed_access_count_7_days > 0 || summary.token_refresh_count > 50) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeIntegration(summary.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};