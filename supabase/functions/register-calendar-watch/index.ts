import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterRequest {
  integrationId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Register watch request from user:', userId);

    const { integrationId } = await req.json() as RegisterRequest;
    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    // Get integration details using safe RPC
    const { data: integrations, error: intError } = await supabaseClient
      .rpc('get_calendar_integration_safe', { integration_id: integrationId });

    if (intError || !integrations || integrations.length === 0) {
      throw new Error('Integration not found or access denied');
    }

    const integration = integrations[0];
    console.log('Registering watch for:', integration.integration_type, 'calendar:', integration.calendar_id);

    // Get decrypted access token
    const { data: decryptedTokens, error: decryptError } = await supabaseClient
      .rpc('get_decrypted_calendar_tokens', { integration_id_param: integrationId });

    if (decryptError || !decryptedTokens || decryptedTokens.length === 0) {
      throw new Error('Failed to get calendar tokens');
    }

    const tokenData = decryptedTokens[0];
    if (tokenData.access_token?.startsWith('DECRYPTION_FAILED:')) {
      throw new Error('Calendar connection is outdated. Please reconnect.');
    }

    let accessToken = tokenData.access_token;

    // Check if token needs refresh
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    const needsRefresh = expiresAt ? (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) : false;

    if (needsRefresh && tokenData.refresh_token) {
      accessToken = await refreshToken(supabaseClient, integration, tokenData.refresh_token, integrationId);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const webhookBaseUrl = `${supabaseUrl}/functions/v1/calendar-webhooks`;

    // Use service role to manage webhook channels table
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let channelId: string;
    let expiration: string;

    if (integration.integration_type === 'google') {
      // Register Google Calendar watch
      channelId = crypto.randomUUID();
      const watchUrl = `${webhookBaseUrl}?provider=google`;

      const watchResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events/watch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: channelId,
            type: 'web_hook',
            address: watchUrl,
            params: { ttl: '604800' }, // 7 days
          }),
        }
      );

      if (!watchResponse.ok) {
        const errorText = await watchResponse.text();
        console.error('Google watch registration failed:', watchResponse.status, errorText);
        throw new Error(`Failed to register Google watch: ${errorText}`);
      }

      const watchData = await watchResponse.json();
      console.log('Google watch registered:', watchData);
      
      expiration = new Date(parseInt(watchData.expiration)).toISOString();

      // Store the channel
      const { error: upsertError } = await supabaseAdmin
        .from('calendar_webhook_channels')
        .upsert({
          integration_id: integrationId,
          provider: 'google',
          channel_id: channelId,
          resource_id: watchData.resourceId,
          expiration,
          webhook_url: watchUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'integration_id' });

      if (upsertError) {
        console.error('Failed to store watch channel:', upsertError);
      }

    } else if (integration.integration_type === 'microsoft') {
      // Register Microsoft Graph subscription
      const watchUrl = `${webhookBaseUrl}?provider=microsoft`;
      // Microsoft subscriptions max 3 days for calendars
      const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const subResponse = await fetch(
        'https://graph.microsoft.com/v1.0/subscriptions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            changeType: 'created,updated,deleted',
            notificationUrl: watchUrl,
            resource: `/me/calendars/${integration.calendar_id}/events`,
            expirationDateTime,
            clientState: integrationId, // used for validation
          }),
        }
      );

      if (!subResponse.ok) {
        const errorText = await subResponse.text();
        console.error('Microsoft subscription failed:', subResponse.status, errorText);
        throw new Error(`Failed to register Microsoft subscription: ${errorText}`);
      }

      const subData = await subResponse.json();
      console.log('Microsoft subscription registered:', subData);

      channelId = subData.id;
      expiration = subData.expirationDateTime;

      const { error: upsertError } = await supabaseAdmin
        .from('calendar_webhook_channels')
        .upsert({
          integration_id: integrationId,
          provider: 'microsoft',
          channel_id: channelId,
          resource_id: null,
          expiration,
          webhook_url: watchUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'integration_id' });

      if (upsertError) {
        console.error('Failed to store subscription:', upsertError);
      }
    } else {
      throw new Error('Unsupported integration type');
    }

    return new Response(
      JSON.stringify({ success: true, channelId, expiration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Register watch error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function refreshToken(
  supabaseClient: any,
  integration: any,
  refreshToken: string,
  integrationId: string
): Promise<string> {
  let tokenUrl = '';
  let clientId = '';
  let clientSecret = '';

  if (integration.integration_type === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    const { data: gClientId } = await supabaseClient.rpc('get_oauth_credential', { credential_key: 'google_client_id' });
    const { data: gClientSecret } = await supabaseClient.rpc('get_oauth_credential', { credential_key: 'google_client_secret' });
    if (!gClientId || !gClientSecret) throw new Error('Google OAuth credentials not configured');
    clientId = gClientId;
    clientSecret = gClientSecret;
  } else {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const { data: mClientId } = await supabaseClient.rpc('get_oauth_credential', { credential_key: 'microsoft_client_id' });
    const { data: mClientSecret } = await supabaseClient.rpc('get_oauth_credential', { credential_key: 'microsoft_client_secret' });
    if (!mClientId || !mClientSecret) throw new Error('Microsoft OAuth credentials not configured');
    clientId = mClientId;
    clientSecret = mClientSecret;
  }

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await tokenResponse.json();
  
  await supabaseClient.rpc('update_calendar_integration_tokens', {
    integration_id_param: integrationId,
    new_access_token: tokens.access_token,
    new_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });

  return tokens.access_token;
}
