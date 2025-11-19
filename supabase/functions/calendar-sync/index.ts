import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  integrationId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      throw new Error('Unauthorized - please sign in');
    }

    console.log('Sync request from user:', user.id);

    const { integrationId } = await req.json() as SyncRequest;

    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    console.log('Starting sync for integration:', integrationId);

    // Fetch integration details using secure function
    const { data: integrations, error: integrationError } = await supabaseClient
      .rpc('get_calendar_integration_safe', { integration_id: integrationId });

    if (integrationError || !integrations || integrations.length === 0) {
      throw new Error('Integration not found or access denied');
    }

    const integration = integrations[0];
    console.log('Found integration:', integration.integration_type);

    // Check if token needs refresh
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    const needsRefresh = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000; // Refresh if expires in < 5 minutes

    let accessToken = integration.access_token;

    if (needsRefresh) {
      console.log('Token needs refresh, refreshing...');
      
      // Decrypt refresh token
      const { data: refreshToken, error: decryptError } = await supabaseClient
        .rpc('decrypt_oauth_token', {
          encrypted_data: integration.refresh_token,
          requesting_integration_id: integrationId,
          token_type: 'refresh_token'
        });

      if (decryptError || !refreshToken) {
        throw new Error('Failed to decrypt refresh token');
      }

      // Refresh token based on provider
      let tokenUrl = '';
      let clientId = '';
      let clientSecret = '';

      if (integration.integration_type === 'google') {
        tokenUrl = 'https://oauth2.googleapis.com/token';
        clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || '';
        clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || '';
      } else if (integration.integration_type === 'microsoft') {
        tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        clientId = Deno.env.get('MICROSOFT_CALENDAR_CLIENT_ID') || '';
        clientSecret = Deno.env.get('MICROSOFT_CALENDAR_CLIENT_SECRET') || '';
      } else {
        throw new Error('Unsupported integration type');
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
        console.error('Token refresh failed');
        throw new Error('Failed to refresh access token');
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;

      // Update tokens in database using secure function
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      
      await supabaseClient.rpc('update_calendar_integration_tokens', {
        integration_id_param: integrationId,
        new_access_token: tokens.access_token,
        new_expires_at: expiresAt,
      });

      console.log('Token refreshed successfully');
    }

    // Fetch events from external calendar (stub for now)
    let eventsUrl = '';
    if (integration.integration_type === 'google') {
      eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events`;
    } else if (integration.integration_type === 'microsoft') {
      eventsUrl = `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events`;
    }

    console.log('Fetching events from:', eventsUrl);

    const eventsResponse = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!eventsResponse.ok) {
      throw new Error('Failed to fetch external events');
    }

    const eventsData = await eventsResponse.json();
    const eventCount = integration.integration_type === 'google' 
      ? eventsData.items?.length || 0
      : eventsData.value?.length || 0;

    console.log(`Fetched ${eventCount} events from external calendar`);

    // TODO: In next phase, we will:
    // 1. Parse external events
    // 2. Map to internal event format
    // 3. Upsert into events table
    // 4. Handle recurring events
    // 5. Store sync cursor (syncToken/deltaLink)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync completed successfully',
        eventCount,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
