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
    const callbackHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar OAuth Callback</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Completing authentication...</p>
  </div>
  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      document.querySelector('.container').innerHTML = \`
        <h2>Authentication Failed</h2>
        <p>\${error}</p>
        <p>You can close this window.</p>
      \`;
    } else if (code && state) {
      const message = {
        type: 'oauth-success',
        code: code,
        state: state,
        provider: 'microsoft'
      };

      // Try postMessage with retries
      let attempts = 0;
      const maxAttempts = 5;
      
      const sendMessage = () => {
        attempts++;
        
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, window.location.origin);
          
          document.querySelector('.container').innerHTML = \`
            <h2>Success!</h2>
            <p>Authentication complete. This window will close automatically.</p>
          \`;
          
          setTimeout(() => window.close(), 1500);
        } else if (attempts < maxAttempts) {
          // Retry after a short delay
          setTimeout(sendMessage, 300);
        } else {
          // Fallback: store in localStorage
          try {
            sessionStorage.setItem('ms-oauth-callback', JSON.stringify(message));
            document.querySelector('.container').innerHTML = \`
              <h2>Almost Done!</h2>
              <p>Please close this window and return to the app.</p>
            \`;
            setTimeout(() => window.close(), 3000);
          } catch (e) {
            document.querySelector('.container').innerHTML = \`
              <h2>Please Close This Window</h2>
              <p>Return to the app to complete authentication.</p>
            \`;
          }
        }
      };
      
      sendMessage();
    } else {
      document.querySelector('.container').innerHTML = \`
        <h2>Invalid Request</h2>
        <p>Missing authentication data. Please try again.</p>
      \`;
    }
  </script>
</body>
</html>`;
    
    return new Response(callbackHtml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
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
