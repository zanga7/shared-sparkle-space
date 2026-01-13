import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

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

  // Handle GET requests (OAuth callback from Microsoft) - No longer used, redirect handled by frontend
  if (req.method === 'GET') {
    const url = new URL(req.url);
    return Response.redirect(
      `${url.origin}/admin/calendar-settings?error=deprecated_callback`,
      302
    );
  }

  try {
    // For POST requests, verify user authentication properly
    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create Supabase client for authentication and database operations
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );

      // Properly verify JWT using Supabase auth - this cryptographically validates the token
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims) {
        console.error('JWT verification failed:', claimsError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized - invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = claimsData.claims.sub;
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'No user ID in verified token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Authenticated user:', userId);

      const { action, code, state, profileId } = await req.json() as OAuthRequest;

      // Get OAuth credentials from database
      const { data: microsoftClientId, error: clientIdError } = await supabaseClient
        .rpc('get_oauth_credential', { credential_key: 'microsoft_client_id' });
      
      const { data: microsoftClientSecret, error: clientSecretError } = await supabaseClient
        .rpc('get_oauth_credential', { credential_key: 'microsoft_client_secret' });

      if (clientIdError || clientSecretError || !microsoftClientId || !microsoftClientSecret) {
        throw new Error('Microsoft OAuth credentials not configured in super admin');
      }

      const clientId = microsoftClientId;
      const clientSecret = microsoftClientSecret;
      // Redirect to frontend, not back to edge function
      const redirectUri = `${req.headers.get('origin') || 'https://37c95a9c-b1e8-415f-88ac-4c7efbf8cecf.lovableproject.com'}/admin/calendar-settings`;

      if (action === 'start') {
        // Generate OAuth URL
        const scope = 'Calendars.Read offline_access';
        const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('response_mode', 'query');
        authUrl.searchParams.set('state', JSON.stringify({ userId: userId, profileId, provider: 'microsoft' }));

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

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
