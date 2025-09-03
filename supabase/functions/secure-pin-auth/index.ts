import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { profileId, pin, pinType = 'numeric' } = await req.json();

    if (!profileId || !pin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing profileId or pin' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate PIN format based on type
    if (pinType === 'numeric') {
      if (!/^\d{4}$/.test(pin)) {
        return new Response(
          JSON.stringify({ success: false, error: 'PIN must be exactly 4 digits' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else if (pinType === 'icon') {
      const iconCount = pin.split(',').filter((icon: string) => icon.trim().length > 0).length;
      if (iconCount !== 4) {
        return new Response(
          JSON.stringify({ success: false, error: 'Icon PIN must have exactly 4 icons' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Call the secure authentication function
    const { data, error } = await supabase.rpc('authenticate_member_pin_dashboard', {
      profile_id_param: profileId,
      pin_attempt: pin
    });

    if (error) {
      console.error('Database error during PIN authentication:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in secure-pin-auth function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});