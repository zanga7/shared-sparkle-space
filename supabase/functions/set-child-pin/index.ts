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
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${authHeader}` }
        }
      }
    );

    const requestBody = await req.json();
    console.log('Request body received:', JSON.stringify(requestBody, null, 2));
    
    const { profileId, pin, pinType = 'numeric' } = requestBody;

    console.log('Extracted params:', { profileId, pin: pin ? '[REDACTED]' : 'undefined', pinType });

    if (!profileId || !pin) {
      console.error('Missing required parameters:', { 
        hasProfileId: !!profileId, 
        hasPin: !!pin,
        profileId,
        pinLength: pin ? pin.length : 0
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing profileId or pin' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Calling set_child_pin function with profileId:', profileId);
    
    // Call the secure PIN setting function
    const { data, error } = await supabase.rpc('set_child_pin', {
      profile_id_param: profileId,
      new_pin: pin,
      pin_type_param: pinType
    });

    console.log('Database function response:', { data, error });

    if (error) {
      console.error('Database error during PIN setting:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to set PIN: ' + error.message }),
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
    console.error('Error in set-child-pin function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error: ' + error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});