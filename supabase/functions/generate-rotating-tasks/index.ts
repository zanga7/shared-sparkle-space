import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RotatingTask {
  id: string;
  family_id: string;
  name: string;
  description: string | null;
  points: number;
  cadence: 'daily' | 'weekly' | 'monthly';
  weekly_days: number[] | null;
  monthly_day: number | null;
  member_order: string[];
  current_member_index: number;
  is_active: boolean;
  is_paused: boolean;
  task_group: string;
  allow_multiple_completions: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Starting rotating tasks generation...');

    // Get all active rotating tasks
    const { data: rotatingTasks, error: fetchError } = await supabaseClient
      .from('rotating_tasks')
      .select('*')
      .eq('is_active', true)
      .eq('is_paused', false);

    if (fetchError) {
      console.error('Error fetching rotating tasks:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch rotating tasks' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found ${rotatingTasks?.length || 0} active rotating tasks`);

    let generatedCount = 0;
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    for (const rotatingTask of (rotatingTasks as RotatingTask[]) || []) {
      console.log(`\n🔍 Processing: ${rotatingTask.name}`);
      
      // Check if this task should be generated today
      const shouldGenerate = shouldGenerateToday(rotatingTask, now);
      
      if (!shouldGenerate) {
        console.log(`⏭️  Skipping ${rotatingTask.name} - not due today`);
        continue;
      }

      // Get current assignee
      const currentMemberId = rotatingTask.member_order[rotatingTask.current_member_index];
      
      if (!currentMemberId) {
        console.log(`❌ No member at index ${rotatingTask.current_member_index} for ${rotatingTask.name}`);
        continue;
      }

      // Check if task already exists for today assigned to this specific member
      const { data: existingTasks, error: checkError } = await supabaseClient
        .from('tasks')
        .select('id, task_assignees!inner(profile_id)')
        .eq('family_id', rotatingTask.family_id)
        .eq('title', rotatingTask.name)
        .eq('task_assignees.profile_id', currentMemberId)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);

      if (checkError) {
        console.error(`Error checking existing tasks for ${rotatingTask.name}:`, checkError);
        continue;
      }

      // If allow_multiple_completions is false and task exists, skip
      if (!rotatingTask.allow_multiple_completions && existingTasks && existingTasks.length > 0) {
        console.log(`⏭️  Task ${rotatingTask.name} already exists for today`);
        continue;
      }

      // Create the task instance
      const { data: newTask, error: createError } = await supabaseClient
        .from('tasks')
        .insert({
          family_id: rotatingTask.family_id,
          title: rotatingTask.name,
          description: rotatingTask.description,
          points: rotatingTask.points,
          created_by: rotatingTask.member_order[0], // Use first member as creator
          task_group: rotatingTask.task_group || 'general',
          completion_rule: 'everyone'
        })
        .select()
        .single();

      if (createError) {
        console.error(`❌ Error creating task ${rotatingTask.name}:`, createError);
        continue;
      }

      // Assign to current member
      const { error: assignError } = await supabaseClient
        .from('task_assignees')
        .insert({
          task_id: newTask.id,
          profile_id: currentMemberId,
          assigned_by: rotatingTask.member_order[0]
        });

      if (assignError) {
        console.error(`❌ Error assigning task ${rotatingTask.name}:`, assignError);
        // Delete the task if assignment failed
        await supabaseClient.from('tasks').delete().eq('id', newTask.id);
        continue;
      }

      console.log(`✅ Created task ${rotatingTask.name} for member ${currentMemberId}`);
      generatedCount++;

      // Rotate to next member
      const nextIndex = (rotatingTask.current_member_index + 1) % rotatingTask.member_order.length;
      
      const { error: updateError } = await supabaseClient
        .from('rotating_tasks')
        .update({ 
          current_member_index: nextIndex,
          updated_at: now.toISOString()
        })
        .eq('id', rotatingTask.id);

      if (updateError) {
        console.error(`⚠️  Error rotating index for ${rotatingTask.name}:`, updateError);
      } else {
        console.log(`🔄 Rotated ${rotatingTask.name} to member index ${nextIndex}`);
      }
    }

    console.log(`\n✨ Generation complete: ${generatedCount} tasks created`);

    return new Response(JSON.stringify({ 
      message: `Generated ${generatedCount} rotating tasks`,
      count: generatedCount,
      timestamp: now.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in generate-rotating-tasks function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})

function shouldGenerateToday(task: RotatingTask, now: Date): boolean {
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const dayOfMonth = now.getDate();

  switch (task.cadence) {
    case 'daily':
      return true; // Generate every day

    case 'weekly':
      // If weekly_days is specified, check if today is in the list
      if (task.weekly_days && task.weekly_days.length > 0) {
        return task.weekly_days.includes(dayOfWeek);
      }
      // If no specific days, generate every day of the week
      return true;

    case 'monthly':
      // If monthly_day is specified, check if today matches
      if (task.monthly_day) {
        return dayOfMonth === task.monthly_day;
      }
      // Default to first day of month
      return dayOfMonth === 1;

    default:
      return false;
  }
}
