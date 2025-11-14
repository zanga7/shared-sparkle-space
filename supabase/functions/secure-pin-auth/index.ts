import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const pinAuthSchema = z.object({
  profileId: z.string().uuid({ message: 'Invalid profile ID format' }),
  pin: z.string()
    .min(1, { message: 'PIN cannot be empty' })
    .max(100, { message: 'PIN is too long' }),
  pinType: z.enum(['numeric', 'icon']).default('numeric')
});

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

    // Parse and validate request body
    const body = await req.json();
    const validationResult = pinAuthSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid input',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { profileId, pin, pinType } = validationResult.data;

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