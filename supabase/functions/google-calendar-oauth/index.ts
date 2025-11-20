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

  // Handle GET requests (OAuth callback from Google) - No longer used, redirect handled by frontend
  if (req.method === 'GET') {
    const url = new URL(req.url);
    return Response.redirect(
      `${url.origin}/admin/calendar-settings?error=deprecated_callback`,
      302
    );
  }

  try {
    // For POST requests, extract user from JWT (already verified by Supabase)
    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }

      // Extract and decode JWT - already verified by Supabase when verify_jwt=true
      const jwt = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const userId = payload.sub;
      
      if (!userId) {
        throw new Error('No user ID in token');
      }

      console.log('Authenticated user:', userId);

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

      const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');
      // Redirect to frontend, not back to edge function
      const redirectUri = `${req.headers.get('origin') || 'https://37c95a9c-b1e8-415f-88ac-4c7efbf8cecf.lovableproject.com'}/admin/calendar-settings`;

      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }

      if (action === 'start') {
        // Generate OAuth URL
        const scope = 'https://www.googleapis.com/auth/calendar.readonly';
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', JSON.stringify({ userId: userId, profileId, provider: 'google' }));

        console.log('Generated OAuth URL for user:', userId);

        return new Response(
          JSON.stringify({ authUrl: authUrl.toString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'callback' && code && state) {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.text();
          console.error('Token exchange failed:', error);
          throw new Error('Failed to exchange authorization code');
        }

        const tokens = await tokenResponse.json();
        console.log('Successfully exchanged code for tokens');

        // Fetch available calendars
        const calendarsResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }
        );

        if (!calendarsResponse.ok) {
          throw new Error('Failed to fetch calendars');
        }

        const calendarsData = await calendarsResponse.json();
        const calendars = calendarsData.items.map((cal: any) => ({
          id: cal.id,
          summary: cal.summary,
          primary: cal.primary || false,
          accessRole: cal.accessRole,
        }));

        console.log('Fetched calendars:', calendars.length);

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
    console.error('OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
