import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  integrationId: string;
}

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
}

interface MicrosoftEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  attendees?: Array<{ emailAddress: { address: string } }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const userId = payload.sub;

    if (!userId) {
      throw new Error('No user ID in token');
    }

    console.log('Sync request from user:', userId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { integrationId } = await req.json() as SyncRequest;

    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    console.log('Starting sync for integration:', integrationId);

    const { data: integrations, error: integrationError } = await supabaseClient
      .rpc('get_calendar_integration_safe', { integration_id: integrationId });

    if (integrationError || !integrations || integrations.length === 0) {
      throw new Error('Integration not found or access denied');
    }

    const integration = integrations[0];
    console.log('Found integration:', integration.integration_type);

    const { data: decryptedTokens, error: decryptError } = await supabaseClient
      .rpc('get_decrypted_calendar_tokens', { integration_id_param: integrationId });

    if (decryptError || !decryptedTokens || decryptedTokens.length === 0) {
      console.error('Failed to get tokens:', decryptError);
      throw new Error('Calendar tokens need reconnection. Please disconnect and reconnect your calendar.');
    }

    const tokenData = decryptedTokens[0];
    
    if (tokenData.access_token?.startsWith('DECRYPTION_FAILED:')) {
      console.error('Token decryption failed:', tokenData.access_token);
      throw new Error('Calendar connection is outdated. Please reconnect your calendar.');
    }
    
    console.log('Got tokens, expires:', tokenData.expires_at, 'is_expired:', tokenData.is_expired);

    const now = new Date();
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    const needsRefresh = expiresAt ? (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) : false;

    let accessToken = tokenData.access_token;

    if (needsRefresh) {
      console.log('Token needs refresh, refreshing...');
      
      const refreshToken = tokenData.refresh_token;
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

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

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      
      await supabaseClient.rpc('update_calendar_integration_tokens', {
        integration_id_param: integrationId,
        new_access_token: tokens.access_token,
        new_expires_at: expiresAt,
      });

      console.log('Token refreshed successfully');
    }

    // Fetch events from external calendar
    let eventsUrl = '';
    if (integration.integration_type === 'google') {
      eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events?maxResults=250&timeMin=${new Date().toISOString()}`;
    } else if (integration.integration_type === 'microsoft') {
      eventsUrl = `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events?$top=250&$filter=start/dateTime ge '${new Date().toISOString()}'`;
    }

    console.log('Fetching events from:', eventsUrl);

    const eventsResponse = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('External API error:', eventsResponse.status, errorText);
      throw new Error(`Failed to fetch external events: ${eventsResponse.status}`);
    }

    const eventsData = await eventsResponse.json();
    const rawEvents = integration.integration_type === 'google' 
      ? (eventsData.items || [])
      : (eventsData.value || []);

    console.log(`Fetched ${rawEvents.length} events from external calendar`);

    // Get profile to use as creator
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('id, family_id')
      .eq('id', integration.profile_id)
      .single();

    if (!profileData) {
      throw new Error('Profile not found for integration');
    }

    // Parse and store events
    let syncedCount = 0;
    for (const rawEvent of rawEvents) {
      try {
        let eventData: any;

        if (integration.integration_type === 'google') {
          const gEvent = rawEvent as GoogleEvent;
          const isAllDay = !!gEvent.start.date;
          
          eventData = {
            title: gEvent.summary || 'Untitled Event',
            description: gEvent.description || null,
            location: gEvent.location || null,
            start_date: isAllDay ? `${gEvent.start.date}T00:00:00Z` : gEvent.start.dateTime,
            end_date: isAllDay ? `${gEvent.end.date}T23:59:59Z` : gEvent.end.dateTime,
            is_all_day: isAllDay,
            family_id: profileData.family_id,
            created_by: profileData.id,
            source_integration_id: integrationId,
            source_type: 'google',
            external_event_id: gEvent.id,
            last_synced_at: new Date().toISOString(),
          };
        } else {
          const mEvent = rawEvent as MicrosoftEvent;
          
          eventData = {
            title: mEvent.subject || 'Untitled Event',
            description: mEvent.bodyPreview || null,
            location: mEvent.location?.displayName || null,
            start_date: mEvent.start.dateTime,
            end_date: mEvent.end.dateTime,
            is_all_day: mEvent.isAllDay,
            family_id: profileData.family_id,
            created_by: profileData.id,
            source_integration_id: integrationId,
            source_type: 'microsoft',
            external_event_id: mEvent.id,
            last_synced_at: new Date().toISOString(),
          };
        }

        // Upsert event (insert or update based on external_event_id + source_integration_id)
        const { error: upsertError } = await supabaseClient
          .from('events')
          .upsert(eventData, {
            onConflict: 'external_event_id,source_integration_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('Error upserting event:', upsertError);
        } else {
          syncedCount++;
        }
      } catch (error) {
        console.error('Error processing event:', error);
      }
    }

    // Update integration last_sync_at
    await supabaseClient
      .from('calendar_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integrationId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync completed successfully',
        eventCount: rawEvents.length,
        syncedCount,
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