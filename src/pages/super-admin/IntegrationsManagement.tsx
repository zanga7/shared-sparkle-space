import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2, Save, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface OAuthCredentials {
  google_client_id: string | null;
  google_client_secret: string | null;
  microsoft_client_id: string | null;
  microsoft_client_secret: string | null;
}

export default function IntegrationsManagement() {
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState({
    google: false,
    microsoft: false
  });

  const [formData, setFormData] = useState<OAuthCredentials>({
    google_client_id: '',
    google_client_secret: '',
    microsoft_client_id: '',
    microsoft_client_secret: ''
  });

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['oauth-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_oauth_credentials');
      if (error) throw error;
      return data as OAuthCredentials;
    },
    onSuccess: (data) => {
      setFormData(data);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<OAuthCredentials>) => {
      const { error } = await supabase.rpc('update_oauth_credentials', {
        credentials: updates
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-credentials'] });
      toast.success('OAuth credentials updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update credentials: ' + error.message);
    }
  });

  const handleSaveGoogle = () => {
    updateMutation.mutate({
      google_client_id: formData.google_client_id,
      google_client_secret: formData.google_client_secret
    });
  };

  const handleSaveMicrosoft = () => {
    updateMutation.mutate({
      microsoft_client_id: formData.microsoft_client_id,
      microsoft_client_secret: formData.microsoft_client_secret
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">OAuth Integrations</h2>
          <p className="text-muted-foreground">Manage calendar integration credentials</p>
        </div>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasGoogleCreds = credentials?.google_client_id && credentials?.google_client_secret;
  const hasMicrosoftCreds = credentials?.microsoft_client_id && credentials?.microsoft_client_secret;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">OAuth Integrations</h2>
        <p className="text-muted-foreground">Manage calendar integration credentials</p>
      </div>

      <Alert>
        <Link2 className="h-4 w-4" />
        <AlertDescription>
          These credentials are used by all families for calendar integrations. Changes affect the entire system.
          Make sure to add the correct redirect URIs in your OAuth apps.
        </AlertDescription>
      </Alert>

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Google Calendar
              {hasGoogleCreds ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground" />
              )}
            </span>
          </CardTitle>
          <CardDescription>
            OAuth credentials for Google Calendar integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="google_client_id">Client ID</Label>
            <Input
              id="google_client_id"
              value={formData.google_client_id || ''}
              onChange={(e) => setFormData({ ...formData, google_client_id: e.target.value })}
              placeholder="Enter Google Client ID"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="google_client_secret">Client Secret</Label>
            <div className="flex gap-2">
              <Input
                id="google_client_secret"
                type={showSecrets.google ? 'text' : 'password'}
                value={formData.google_client_secret || ''}
                onChange={(e) => setFormData({ ...formData, google_client_secret: e.target.value })}
                placeholder="Enter Google Client Secret"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSecrets({ ...showSecrets, google: !showSecrets.google })}
              >
                {showSecrets.google ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSaveGoogle} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Save Google Credentials
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              <strong>Redirect URI:</strong> https://timefstlnqojqidllokb.supabase.co/functions/v1/google-calendar-oauth
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Microsoft Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Microsoft Calendar
              {hasMicrosoftCreds ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground" />
              )}
            </span>
          </CardTitle>
          <CardDescription>
            OAuth credentials for Microsoft Calendar integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="microsoft_client_id">Client ID</Label>
            <Input
              id="microsoft_client_id"
              value={formData.microsoft_client_id || ''}
              onChange={(e) => setFormData({ ...formData, microsoft_client_id: e.target.value })}
              placeholder="Enter Microsoft Client ID"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="microsoft_client_secret">Client Secret</Label>
            <div className="flex gap-2">
              <Input
                id="microsoft_client_secret"
                type={showSecrets.microsoft ? 'text' : 'password'}
                value={formData.microsoft_client_secret || ''}
                onChange={(e) => setFormData({ ...formData, microsoft_client_secret: e.target.value })}
                placeholder="Enter Microsoft Client Secret"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSecrets({ ...showSecrets, microsoft: !showSecrets.microsoft })}
              >
                {showSecrets.microsoft ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSaveMicrosoft} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Save Microsoft Credentials
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              <strong>Redirect URI:</strong> https://timefstlnqojqidllokb.supabase.co/functions/v1/microsoft-calendar-oauth
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
