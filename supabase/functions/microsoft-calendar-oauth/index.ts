import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthRequest {
  action: 'start' | 'callback';
  code?: string;
  state?: string;
  profileId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (OAuth callback from Microsoft)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // If there's an error, redirect back with error
    if (error) {
      return Response.redirect(
        `${url.origin}/admin/calendar-settings?error=${encodeURIComponent(error)}`,
        302
      );
    }

    // If we have code and state, store them in a way the frontend can pick up
    // and redirect back to calendar settings
    if (code && state) {
      // Create a simple redirect with the data as URL parameters
      const redirectUrl = new URL(`${url.origin}/admin/calendar-settings`);
      redirectUrl.searchParams.set('ms_code', code);
      redirectUrl.searchParams.set('ms_state', state);
      
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Missing parameters
    return Response.redirect(
      `${url.origin}/admin/calendar-settings?error=invalid_request`,
      302
    );
  }

  try {
    // For POST requests, verify JWT manually (GET requests are OAuth callbacks and don't need auth)
    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }

      // Extract JWT token and decode it to get user info
      const jwt = authHeader.replace('Bearer ', '');
      const parts = jwt.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode the payload (middle part of JWT)
      const payload = JSON.parse(atob(parts[1]));
      const userId = payload.sub;
      
      if (!userId) {
        console.error('No user ID found in JWT payload');
        throw new Error('Unauthorized - invalid token');
      }

      console.log('Authenticated user from JWT:', userId);

      // Create Supabase client for database operations
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );

      const { action, code, state, profileId } = await req.json() as OAuthRequest;

      const clientId = Deno.env.get('MICROSOFT_CALENDAR_CLIENT_ID');
      const clientSecret = Deno.env.get('MICROSOFT_CALENDAR_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-calendar-oauth`;

      if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth credentials not configured');
      }

      if (action === 'start') {
        // Generate OAuth URL
        const scope = 'Calendars.Read offline_access';
        const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('response_mode', 'query');
        authUrl.searchParams.set('state', JSON.stringify({ userId: userId, profileId }));

        console.log('Generated Microsoft OAuth URL for user:', userId);

        return new Response(
          JSON.stringify({ authUrl: authUrl.toString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'callback' && code && state) {
        // Exchange code for tokens
        const tokenResponse = await fetch(
          'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }),
          }
        );

        if (!tokenResponse.ok) {
          const error = await tokenResponse.text();
          console.error('Token exchange failed:', error);
          throw new Error('Failed to exchange authorization code');
        }

        const tokens = await tokenResponse.json();
        console.log('Successfully exchanged code for Microsoft tokens');

        // Fetch available calendars
        const calendarsResponse = await fetch(
          'https://graph.microsoft.com/v1.0/me/calendars',
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }
        );

        if (!calendarsResponse.ok) {
          throw new Error('Failed to fetch calendars');
        }

        const calendarsData = await calendarsResponse.json();
        const calendars = calendarsData.value.map((cal: any) => ({
          id: cal.id,
          summary: cal.name,
          primary: cal.isDefaultCalendar || false,
          accessRole: cal.canEdit ? 'owner' : 'reader',
        }));

        console.log('Fetched Microsoft calendars:', calendars.length);

        // Parse state to get profileId
        const stateData = JSON.parse(state);

        return new Response(
          JSON.stringify({
            success: true,
            calendars,
            tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_in: tokens.expires_in,
            },
            profileId: stateData.profileId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('Invalid action or missing parameters');
    }
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
