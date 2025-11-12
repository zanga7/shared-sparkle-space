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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting daily cleanup of completed tasks...');

    // Get the start of today in UTC
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    console.log(`Deleting task completions before: ${startOfToday.toISOString()}`);

    // Delete all task completions from before today
    const { data, error } = await supabaseClient
      .from('task_completions')
      .delete()
      .lt('completed_at', startOfToday.toISOString());

    if (error) {
      console.error('Error deleting task completions:', error);
      throw error;
    }

    console.log(`Successfully cleaned up completed tasks`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Completed tasks cleaned up successfully',
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
