import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Shield, Lock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EncryptionStatus {
  total_integrations: number;
  encrypted_integrations: number;
  unencrypted_integrations: number;
  encryption_complete: boolean;
}

export const TokenSecurityManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEncryptionStatus();
    }
  }, [user]);

  const fetchEncryptionStatus = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_token_encryption_status');
      
      if (error) throw error;
      
      const status = data as unknown as EncryptionStatus;
      setEncryptionStatus(status);
      
    } catch (error) {
      console.error('Error fetching encryption status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load token encryption status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const runTokenMigration = async () => {
    try {
      setMigrating(true);
      
      const { data, error } = await supabase.rpc('migrate_existing_tokens_to_encrypted');
      
      if (error) throw error;
      
      const result = data as { success: boolean; migrated_count: number; message?: string; error?: string };
      
      if (result.success) {
        toast({
          title: 'Migration Complete',
          description: `Successfully encrypted ${result.migrated_count} calendar tokens`,
        });
        
        // Refresh status
        await fetchEncryptionStatus();
      } else {
        throw new Error(result.error || 'Migration failed');
      }
      
    } catch (error) {
      console.error('Error migrating tokens:', error);
      toast({
        title: 'Migration Failed',
        description: 'Failed to encrypt existing tokens. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Token Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading security status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!encryptionStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Token Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load token encryption status. Please refresh the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const encryptionProgress = encryptionStatus.total_integrations > 0 
    ? (encryptionStatus.encrypted_integrations / encryptionStatus.total_integrations) * 100 
    : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Calendar Token Security
        </CardTitle>
        <CardDescription>
          Monitor and manage the encryption status of your family's calendar access tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {encryptionStatus.total_integrations}
            </div>
            <div className="text-sm text-muted-foreground">Total Integrations</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {encryptionStatus.encrypted_integrations}
            </div>
            <div className="text-sm text-muted-foreground">Encrypted</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {encryptionStatus.unencrypted_integrations}
            </div>
            <div className="text-sm text-muted-foreground">Unencrypted</div>
          </div>
        </div>

        {/* Encryption Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Encryption Progress</span>
            <span className="text-sm text-muted-foreground">
              {Math.round(encryptionProgress)}%
            </span>
          </div>
          <Progress value={encryptionProgress} className="h-2" />
        </div>

        {/* Security Status Alert */}
        {encryptionStatus.encryption_complete ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>All calendar tokens are securely encrypted!</span>
              <Badge variant="default" className="ml-2">
                <Lock className="h-3 w-3 mr-1" />
                Secure
              </Badge>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <strong>Security Warning:</strong> {encryptionStatus.unencrypted_integrations} calendar tokens are not encrypted and could be vulnerable to unauthorized access.
                </div>
                <Button 
                  onClick={runTokenMigration}
                  disabled={migrating}
                  size="sm"
                  className="mt-2"
                >
                  {migrating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Encrypting Tokens...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Encrypt All Tokens
                    </>
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Security Features */}
        <div className="space-y-3">
          <h4 className="font-medium">Security Features Enabled</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">AES-256 Encryption</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Salted Encryption Keys</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Access Audit Logging</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Owner-Only Access</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchEncryptionStatus}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
          
          {encryptionStatus.total_integrations > 0 && (
            <div className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};