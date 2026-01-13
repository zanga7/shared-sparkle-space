import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated using Supabase auth
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('JWT verification failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user for cleanup:', userId);

    // Check if user is a super admin
    const { data: isSuperAdmin, error: roleError } = await supabaseAuth.rpc('is_super_admin');
    
    if (roleError || !isSuperAdmin) {
      console.error('User is not super admin:', userId);
      return new Response(
        JSON.stringify({ error: 'Forbidden - requires super admin privileges' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now use service role key for the actual cleanup operation
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cleanup of old completed tasks...');

    // Get housekeeping settings - we're using this to hide completed tasks
    // NOT to delete task_completions (which are needed for points history)
    
    // Call the RPC function that hides completed tasks
    // This sets hidden_at on tasks, it does NOT delete completions
    const { data: families, error: familiesError } = await supabaseClient
      .from('families')
      .select('id');

    if (familiesError) {
      console.error('Error fetching families:', familiesError);
      throw familiesError;
    }

    let hiddenCount = 0;
    for (const family of families || []) {
      const { data, error } = await supabaseClient.rpc('hide_completed_tasks', {
        p_family_id: family.id
      });

      if (error) {
        console.error(`Error hiding tasks for family ${family.id}:`, error);
        continue;
      }

      if (data?.hidden_count) {
        hiddenCount += data.hidden_count;
      }
    }

    console.log(`Successfully hid ${hiddenCount} completed tasks`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Completed tasks cleanup finished',
        hidden_count: hiddenCount,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup-completed-tasks function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
