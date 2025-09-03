import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting rotating task instance generation...');

    // Get all active rotating tasks
    const { data: rotatingTasks, error: fetchError } = await supabaseClient
      .from('rotating_tasks')
      .select('*')
      .eq('is_active', true)
      .eq('is_paused', false);

    if (fetchError) {
      console.error('Error fetching rotating tasks:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${rotatingTasks?.length || 0} active rotating tasks`);

    const today = new Date();
    const tasksCreated = [];

    for (const rotatingTask of rotatingTasks || []) {
      console.log(`Processing rotating task: ${rotatingTask.name}`);
      
      // Check if we should generate a task today based on cadence
      const shouldGenerate = shouldGenerateToday(rotatingTask, today);
      
      if (!shouldGenerate) {
        console.log(`Skipping ${rotatingTask.name} - not due today`);
        continue;
      }

      // Check if task already exists for today
      const todayStr = today.toISOString().split('T')[0];
      const { data: existingTasks } = await supabaseClient
        .from('tasks')
        .select('id')
        .eq('title', rotatingTask.name)
        .gte('due_date', todayStr + 'T00:00:00Z')
        .lt('due_date', todayStr + 'T23:59:59Z');

      if (existingTasks && existingTasks.length > 0) {
        console.log(`Task ${rotatingTask.name} already exists for today`);
        continue;
      }

      // Get current member
      const currentMemberId = rotatingTask.member_order[rotatingTask.current_member_index];
      
      // Create task instance
      const dueDate = new Date(today);
      dueDate.setHours(9, 0, 0, 0); // Default to 9 AM

      const { data: newTask, error: createError } = await supabaseClient
        .from('tasks')
        .insert({
          title: rotatingTask.name,
          description: rotatingTask.description,
          points: rotatingTask.points,
          assigned_to: currentMemberId,
          family_id: rotatingTask.family_id,
          created_by: rotatingTask.created_by,
          due_date: dueDate.toISOString(),
          task_group: rotatingTask.task_group || 'general'
        })
        .select()
        .single();

      if (createError) {
        console.error(`Error creating task for ${rotatingTask.name}:`, createError);
        continue;
      }

      // Create task assignee entry (this is what the dashboard uses to display tasks)
      const { error: assigneeError } = await supabaseClient
        .from('task_assignees')
        .insert({
          task_id: newTask.id,
          profile_id: currentMemberId,
          assigned_by: rotatingTask.created_by,
          assigned_at: new Date().toISOString()
        });

      if (assigneeError) {
        console.error(`Error creating task assignee for ${rotatingTask.name}:`, assigneeError);
        // Don't continue here - the task was created, just log the assignee error
      }

      tasksCreated.push(newTask);
      console.log(`Created task: ${rotatingTask.name} for member ${currentMemberId} with assignee entry`);

      // Rotate to next member for next time
      const nextIndex = (rotatingTask.current_member_index + 1) % rotatingTask.member_order.length;
      
      const { error: updateError } = await supabaseClient
        .from('rotating_tasks')
        .update({ current_member_index: nextIndex })
        .eq('id', rotatingTask.id);

      if (updateError) {
        console.error(`Error updating rotating task ${rotatingTask.name}:`, updateError);
      }
    }

    console.log(`Successfully created ${tasksCreated.length} rotating task instances`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksCreated: tasksCreated.length,
        tasks: tasksCreated 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-rotating-task-instances:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function shouldGenerateToday(rotatingTask: any, today: Date): boolean {
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayOfMonth = today.getDate();

  switch (rotatingTask.cadence) {
    case 'daily':
      return true;
      
    case 'weekly':
      if (rotatingTask.weekly_days && rotatingTask.weekly_days.length > 0) {
        return rotatingTask.weekly_days.includes(dayOfWeek);
      }
      return dayOfWeek === 1; // Default to Monday
      
    case 'monthly':
      if (rotatingTask.monthly_day) {
        return dayOfMonth === rotatingTask.monthly_day;
      }
      return dayOfMonth === 1; // Default to 1st of month
      
    default:
      return false;
  }
}