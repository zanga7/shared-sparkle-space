import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  integrationId: string;
  direction?: 'pull' | 'push' | 'both';
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

    const { integrationId, direction = 'both' } = await req.json() as SyncRequest;

    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    console.log('Starting sync for integration:', integrationId, 'direction:', direction);

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
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorText,
          provider: integration.integration_type
        });
        throw new Error(`Failed to refresh ${integration.integration_type} access token: ${errorText}`);
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

    // Get profile info
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('id, family_id')
      .eq('id', integration.profile_id)
      .single();

    if (!profileData) {
      throw new Error('Profile not found for integration');
    }

    let pulledCount = 0;
    let pushedCount = 0;

    // PULL: Fetch events from external calendar
    if (direction === 'pull' || direction === 'both') {
      // Use start of today to include all events from today onwards
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const timeMin = todayStart.toISOString();
      
      let eventsUrl = '';
      if (integration.integration_type === 'google') {
        eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events?maxResults=250&timeMin=${timeMin}`;
      } else if (integration.integration_type === 'microsoft') {
        eventsUrl = `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events?$top=250&$filter=start/dateTime ge '${timeMin}'`;
      }

      console.log('Fetching events from external calendar...');

      const eventsResponse = await fetch(eventsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        const rawEvents = integration.integration_type === 'google' 
          ? (eventsData.items || [])
          : (eventsData.value || []);

        console.log(`Fetched ${rawEvents.length} events from external calendar`);

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

            const { error: upsertError } = await supabaseClient
              .from('events')
              .upsert(eventData, {
                onConflict: 'external_event_id,source_integration_id',
                ignoreDuplicates: false,
              });

            if (!upsertError) {
              pulledCount++;
            }
          } catch (error) {
            console.error('Error processing pulled event:', error);
          }
        }
      } else {
        console.error('Failed to fetch external events:', eventsResponse.status);
      }
    }

    // PUSH: Push internal events to external calendar
    if (direction === 'push' || direction === 'both') {
      console.log('Fetching internal events to push...');

      // Use start of today to include all events from today onwards
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch events that either:
      // 1. Have no source (never been synced)
      // 2. Have this integration as source (for updates)
      const { data: internalEvents } = await supabaseClient
        .from('events')
        .select('*, event_attendees(profile_id)')
        .eq('family_id', profileData.family_id)
        .or(`source_integration_id.is.null,source_integration_id.eq.${integrationId}`)
        .gte('start_date', todayStart.toISOString());

      console.log(`Found ${internalEvents?.length || 0} internal events`);

      for (const internalEvent of internalEvents || []) {
        try {
          const attendees = internalEvent.event_attendees || [];
          const isAttendee = attendees.some((a: any) => a.profile_id === integration.profile_id);

          if (!isAttendee) {
            console.log(`Skipping "${internalEvent.title}" - profile not an attendee`);
            continue;
          }

          console.log(`Pushing event: ${internalEvent.title}`);

          let externalEventId: string | null = null;

          if (integration.integration_type === 'google') {
            const googleEvent = {
              summary: internalEvent.title,
              description: internalEvent.description || '',
              location: internalEvent.location || '',
              start: internalEvent.is_all_day 
                ? { date: new Date(internalEvent.start_date).toISOString().split('T')[0] }
                : { dateTime: internalEvent.start_date, timeZone: 'UTC' },
              end: internalEvent.is_all_day
                ? { date: new Date(internalEvent.end_date).toISOString().split('T')[0] }
                : { dateTime: internalEvent.end_date, timeZone: 'UTC' },
            };

            const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events`;
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(googleEvent),
            });

            if (createResponse.ok) {
              const createdEvent = await createResponse.json();
              externalEventId = createdEvent.id;
              console.log(`✓ Pushed to Google Calendar: ${internalEvent.title}`);
            } else {
              console.error(`✗ Failed to push to Google:`, await createResponse.text());
            }
          } else if (integration.integration_type === 'microsoft') {
            const msEvent = {
              subject: internalEvent.title,
              body: {
                contentType: 'text',
                content: internalEvent.description || '',
              },
              location: {
                displayName: internalEvent.location || '',
              },
              start: internalEvent.is_all_day
                ? { dateTime: new Date(internalEvent.start_date).toISOString().split('T')[0] + 'T00:00:00', timeZone: 'UTC' }
                : { dateTime: internalEvent.start_date, timeZone: 'UTC' },
              end: internalEvent.is_all_day
                ? { dateTime: new Date(internalEvent.end_date).toISOString().split('T')[0] + 'T23:59:59', timeZone: 'UTC' }
                : { dateTime: internalEvent.end_date, timeZone: 'UTC' },
              isAllDay: internalEvent.is_all_day,
            };

            const createUrl = `https://graph.microsoft.com/v1.0/me/calendars/${integration.calendar_id}/events`;
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(msEvent),
            });

            if (createResponse.ok) {
              const createdEvent = await createResponse.json();
              externalEventId = createdEvent.id;
              console.log(`✓ Pushed to Microsoft Calendar: ${internalEvent.title}`);
            } else {
              console.error(`✗ Failed to push to Microsoft:`, await createResponse.text());
            }
          }

          if (externalEventId) {
            await supabaseClient
              .from('events')
              .update({
                source_integration_id: integrationId,
                source_type: integration.integration_type,
                external_event_id: externalEventId,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', internalEvent.id);

            pushedCount++;
          }
        } catch (eventError) {
          console.error(`Error pushing event ${internalEvent.title}:`, eventError);
        }
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
        pulledCount,
        pushedCount,
        eventCount: pulledCount + pushedCount,
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
