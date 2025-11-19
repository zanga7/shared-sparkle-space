import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-channel-token, x-goog-resource-id, x-goog-resource-state',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');

    console.log('Webhook received from provider:', provider);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    if (provider === 'google') {
      // Google sends notification headers
      const channelId = req.headers.get('x-goog-channel-id');
      const resourceState = req.headers.get('x-goog-resource-state');
      
      console.log('Google webhook:', { channelId, resourceState });

      // Validate webhook (check if channel exists in our system)
      if (!channelId) {
        return new Response('Missing channel ID', { status: 400, headers: corsHeaders });
      }

      // For now, just log and queue a sync job
      if (resourceState === 'sync') {
        console.log('Google webhook sync state - initial verification');
      } else if (resourceState === 'exists') {
        console.log('Google calendar changed, queuing sync job for channel:', channelId);
        // TODO: Queue sync job for this integration
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    if (provider === 'microsoft') {
      // Microsoft sends validation token on subscription creation
      const validationToken = url.searchParams.get('validationToken');
      
      if (validationToken) {
        console.log('Microsoft webhook validation');
        return new Response(validationToken, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      // Parse webhook notification
      const body = await req.json();
      console.log('Microsoft webhook notification:', body);

      // Extract notification details
      if (body.value && Array.isArray(body.value)) {
        for (const notification of body.value) {
          console.log('Calendar changed:', {
            subscriptionId: notification.subscriptionId,
            resource: notification.resource,
            changeType: notification.changeType,
          });
          // TODO: Queue sync job for this integration
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    return new Response('Unknown provider', { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
