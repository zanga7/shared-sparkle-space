import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is designed to be called by a cron job (hourly fallback sync)
// It also renews expiring webhook channels/subscriptions
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. Fetch all active calendar integrations
    const { data: integrations, error: intError } = await supabaseAdmin
      .from('calendar_integrations')
      .select('id, profile_id, integration_type, last_sync_at')
      .eq('is_active', true);

    if (intError) {
      throw new Error(`Failed to fetch integrations: ${intError.message}`);
    }

    console.log(`Found ${integrations?.length || 0} active integrations`);

    let syncedCount = 0;
    let renewedCount = 0;
    let errors: string[] = [];

    for (const integration of integrations || []) {
      try {
        // Trigger pull sync via calendar-sync function
        const response = await fetch(`${supabaseUrl}/functions/v1/calendar-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ 
            integrationId: integration.id, 
            direction: 'pull' 
          }),
        });

        if (response.ok) {
          syncedCount++;
          const result = await response.json();
          console.log(`✓ Synced integration ${integration.id}: ${result.pulledCount || 0} events`);
        } else {
          const errorText = await response.text();
          console.error(`✗ Sync failed for ${integration.id}:`, errorText);
          errors.push(`${integration.id}: ${errorText}`);
        }
      } catch (error) {
        console.error(`Error syncing integration ${integration.id}:`, error);
        errors.push(`${integration.id}: ${error.message}`);
      }
    }

    // 2. Renew expiring webhook channels (within 1 hour of expiration)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    const { data: expiringChannels, error: channelError } = await supabaseAdmin
      .from('calendar_webhook_channels')
      .select('integration_id, provider, channel_id')
      .lt('expiration', oneHourFromNow);

    if (!channelError && expiringChannels && expiringChannels.length > 0) {
      console.log(`Found ${expiringChannels.length} expiring webhook channels to renew`);
      
      for (const channel of expiringChannels) {
        try {
          // Call register-calendar-watch to renew
          const response = await fetch(`${supabaseUrl}/functions/v1/register-calendar-watch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ integrationId: channel.integration_id }),
          });

          if (response.ok) {
            renewedCount++;
            console.log(`✓ Renewed watch for integration ${channel.integration_id}`);
          } else {
            console.error(`✗ Failed to renew watch for ${channel.integration_id}`);
          }
        } catch (error) {
          console.error(`Error renewing watch for ${channel.integration_id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount,
        renewedCount,
        totalIntegrations: integrations?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync-all error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
