import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

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

    // Use service role to access webhook channels and trigger sync
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (provider === 'google') {
      const channelId = req.headers.get('x-goog-channel-id');
      const resourceState = req.headers.get('x-goog-resource-state');
      const resourceId = req.headers.get('x-goog-resource-id');
      
      console.log('Google webhook:', { channelId, resourceState, resourceId });

      if (!channelId) {
        return new Response('Missing channel ID', { status: 400, headers: corsHeaders });
      }

      // Initial sync verification - just acknowledge
      if (resourceState === 'sync') {
        console.log('Google webhook sync state - initial verification');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Calendar changed - find the integration and trigger sync
      if (resourceState === 'exists' || resourceState === 'update') {
        console.log('Google calendar changed, looking up channel:', channelId);
        
        const { data: channel, error: channelError } = await supabaseAdmin
          .from('calendar_webhook_channels')
          .select('integration_id')
          .eq('channel_id', channelId)
          .eq('provider', 'google')
          .single();

        if (channelError || !channel) {
          console.error('Channel not found:', channelId, channelError);
          return new Response('Channel not found', { status: 404, headers: corsHeaders });
        }

        // Trigger a pull sync for this integration
        await triggerSync(supabaseAdmin, channel.integration_id, 'pull');
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
      console.log('Microsoft webhook notification:', JSON.stringify(body));

      if (body.value && Array.isArray(body.value)) {
        for (const notification of body.value) {
          const subscriptionId = notification.subscriptionId;
          console.log('Microsoft calendar changed, subscription:', subscriptionId);

          const { data: channel, error: channelError } = await supabaseAdmin
            .from('calendar_webhook_channels')
            .select('integration_id')
            .eq('channel_id', subscriptionId)
            .eq('provider', 'microsoft')
            .single();

          if (channelError || !channel) {
            console.error('Subscription not found:', subscriptionId, channelError);
            continue;
          }

          await triggerSync(supabaseAdmin, channel.integration_id, 'pull');
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

async function triggerSync(supabaseAdmin: any, integrationId: string, direction: string) {
  try {
    console.log(`Triggering ${direction} sync for integration:`, integrationId);

    // Get the integration's profile to find the user for auth
    const { data: integration, error: intError } = await supabaseAdmin
      .from('calendar_integrations')
      .select('profile_id')
      .eq('id', integrationId)
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      console.error('Integration not found or inactive:', integrationId);
      return;
    }

    // Get the user_id for the profile
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('id', integration.profile_id)
      .single();

    if (profError || !profile?.user_id) {
      console.error('Profile/user not found for integration:', integrationId);
      return;
    }

    // Call calendar-sync using service role with the user context
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const response = await fetch(`${supabaseUrl}/functions/v1/calendar-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ integrationId, direction }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sync trigger failed:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('Sync triggered successfully:', result);
    }
  } catch (error) {
    console.error('Error triggering sync:', error);
  }
}
