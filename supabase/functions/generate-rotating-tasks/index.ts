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
  created_by: string;
  rotate_on_completion: boolean;
  // Note: allow_multiple_completions field exists in DB but is always false
  // Rotating tasks are single-visibility only (one member at a time)
}

interface RotationEvent {
  family_id: string;
  rotating_task_id: string;
  source: 'edge_function' | 'manual';
  previous_index: number;
  selected_index: number;
  next_index: number;
  chosen_member_id: string | null;
  new_task_id: string | null;
  status: 'success' | 'skipped' | 'failed';
  reason: string | null;
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

    // Whether to assign to the next member (used when triggered on completion)
    let assignNextMember = false;
    // Whether this was triggered by a completion event
    let isCompletionTrigger = false;

    // Optional filter from request body to process a single rotating task
    const contentType = req.headers.get('content-type') || '';
    let filter: { id?: string; name?: string; family_id?: string } = {};
    if (contentType.includes('application/json')) {
      try {
        const body = await req.json();
        if (body?.rotating_task_id) filter.id = body.rotating_task_id;
        if (body?.task_name) filter.name = body.task_name;
        if (body?.family_id) filter.family_id = body.family_id;
        if (typeof body?.assign_next_member !== 'undefined') {
          assignNextMember = !!body.assign_next_member;
          isCompletionTrigger = !!body.assign_next_member;
        }
      } catch (_) {
        // ignore JSON parse errors
      }
    }

    let query = supabaseClient
      .from('rotating_tasks')
      .select('*')
      .eq('is_active', true)
      .eq('is_paused', false);

    if (filter.id) {
      query = query.eq('id', filter.id);
      console.log(`🎯 Filtering rotating task by id: ${filter.id}`);
    } else {
      if (filter.name) query = query.ilike('name', filter.name);
      if (filter.family_id) query = query.eq('family_id', filter.family_id);
      if (filter.name || filter.family_id) {
        console.log('🎯 Filtering rotating tasks by name/family', filter);
      }
    }

    const { data: rotatingTasks, error: fetchError } = await query;

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

      // If this is a completion trigger but the task uses scheduled rotation, skip
      if (isCompletionTrigger && rotatingTask.rotate_on_completion === false) {
        console.log(`⏭️  ${rotatingTask.name}: uses scheduled rotation, skipping instant rotate`);
        continue;
      }

      // For scheduled rotation (not completion-triggered), check if today matches the cadence
      if (!isCompletionTrigger && !rotatingTask.rotate_on_completion && !shouldGenerateToday(rotatingTask, now)) {
        console.log(`⏭️  ${rotatingTask.name}: not scheduled for today (cadence: ${rotatingTask.cadence})`);
        continue;
      }

      // Determine which member should receive a task now
      const len = rotatingTask.member_order.length;
      if (len === 0) {
        console.log(`❌ No members defined for ${rotatingTask.name}`);
        continue;
      }

      // Helper: check if any INCOMPLETE task with this rotating_task_id exists (regardless of date)
      const anyIncompleteTaskExists = async (): Promise<boolean> => {
        const { data: existing, error } = await supabaseClient
          .from('tasks')
          .select('id, task_completions(id)')
          .eq('family_id', rotatingTask.family_id)
          .eq('rotating_task_id', rotatingTask.id)
          .is('hidden_at', null); // Only consider visible (non-hidden) tasks
        if (error) {
          console.error(`Error checking existing tasks for ${rotatingTask.name}:`, error);
          return true; // fail-safe: avoid duplicate creation on error
        }
        // Filter to only incomplete tasks (no completion records)
        const incompleteTasks = existing?.filter(task => !task.task_completions || task.task_completions.length === 0) || [];
        console.log(`📊 Found ${incompleteTasks.length} incomplete visible task(s) for ${rotatingTask.name}`);
        return incompleteTasks.length > 0;
      };

      let targetMemberId: string | null = null;
      const originalIndex = rotatingTask.current_member_index;
      let selectedIndex = originalIndex;

      // If assign_next_member is set, immediately advance before any other logic
      if (assignNextMember) {
        console.log('➡️ assign_next_member flag detected; advancing to next member FIRST');
        // Start from the next position in the rotation
        selectedIndex = (originalIndex + 1) % len;
      }

      // Helper: verify candidate exists in profiles for this family
      const candidateIsValid = async (profileId: string | null): Promise<boolean> => {
        if (!profileId) return false;
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', profileId)
          .eq('family_id', rotatingTask.family_id)
          .single();
        return !!data && !error;
      };

      // Helper: log rotation event
      const logRotationEvent = async (event: Omit<RotationEvent, 'family_id' | 'rotating_task_id'>) => {
        await supabaseClient.from('rotation_events').insert({
          family_id: rotatingTask.family_id,
          rotating_task_id: rotatingTask.id,
          source: 'edge_function',
          ...event
        });
      };

      // Rotating tasks are always single-instance: one member at a time
      const exists = await anyIncompleteTaskExists();
      if (exists) {
        console.log(`⏭️  ${rotatingTask.name}: an incomplete task already exists`);
        await logRotationEvent({
          previous_index: originalIndex,
          selected_index: originalIndex,
          next_index: originalIndex,
          chosen_member_id: null,
          new_task_id: null,
          status: 'skipped',
          reason: 'Incomplete task already exists'
        });
        continue;
      }

      // Find the first valid member starting from selected index
      for (let i = 0; i < len; i++) {
        const idx = (selectedIndex + i) % len;
        const candidateId = rotatingTask.member_order[idx] || null;
        if (await candidateIsValid(candidateId)) {
          targetMemberId = candidateId;
          selectedIndex = idx;
          break;
        }
      }

      if (!targetMemberId) {
        console.log(`❌ No valid members found in rotation for ${rotatingTask.name}`);
        await logRotationEvent({
          previous_index: originalIndex,
          selected_index: originalIndex,
          next_index: originalIndex,
          chosen_member_id: null,
          new_task_id: null,
          status: 'failed',
          reason: 'No valid members in rotation'
        });
        continue;
      }

      // Calculate due_date based on task_group
      const getDueDateForGroup = (group: string): string | null => {
        const today = new Date();
        switch (group) {
          case 'morning':
            today.setHours(11, 0, 0, 0);
            return today.toISOString();
          case 'midday':
            today.setHours(15, 0, 0, 0);
            return today.toISOString();
          case 'afternoon':
            today.setHours(18, 0, 0, 0);
            return today.toISOString();
          case 'evening':
            today.setHours(23, 59, 0, 0);
            return today.toISOString();
          case 'general':
          default:
            return null;
        }
      };

      const taskGroup = rotatingTask.task_group || 'general';
      const dueDate = getDueDateForGroup(taskGroup);

      // Optimistic concurrency: reserve the rotation slot before creating the task.
      // If another invocation already rotated, this update will affect 0 rows and we skip.
      const nextIndex = (selectedIndex + 1) % len;
      const { data: rotationReserved, error: reserveError } = await supabaseClient
        .from('rotating_tasks')
        .update({
          current_member_index: nextIndex,
          updated_at: now.toISOString()
        })
        .eq('id', rotatingTask.id)
        .eq('current_member_index', originalIndex)
        .select()
        .single();

      if (reserveError || !rotationReserved) {
        console.log(`⚠️  Concurrency detected or rotation already processed for ${rotatingTask.name}. Skipping creation.`);
        continue;
      }

      // Create the task instance (after successfully reserving rotation)
      const { data: newTask, error: createError } = await supabaseClient
        .from('tasks')
        .insert({
          family_id: rotatingTask.family_id,
          title: rotatingTask.name,
          description: rotatingTask.description,
          points: rotatingTask.points,
          created_by: rotatingTask.created_by,
          task_group: taskGroup,
          due_date: dueDate,
          completion_rule: 'everyone',
          rotating_task_id: rotatingTask.id
        })
        .select()
        .single();

      if (createError) {
        console.error(`❌ Error creating task ${rotatingTask.name}:`, createError);
        // Roll back reserved rotation since task creation failed
        await supabaseClient
          .from('rotating_tasks')
          .update({ current_member_index: originalIndex, updated_at: now.toISOString() })
          .eq('id', rotatingTask.id);
        
        await logRotationEvent({
          previous_index: originalIndex,
          selected_index: selectedIndex,
          next_index: nextIndex,
          chosen_member_id: targetMemberId,
          new_task_id: null,
          status: 'failed',
          reason: `Task creation failed: ${createError?.message || 'Unknown error'}`
        });
        continue;
      }

      // Assign to target member
      const { error: assignError } = await supabaseClient
        .from('task_assignees')
        .insert({
          task_id: newTask.id,
          profile_id: targetMemberId,
          assigned_by: rotatingTask.created_by
        });

      if (assignError) {
        console.error(`❌ Error assigning task ${rotatingTask.name}:`, assignError);
        // Delete the task if assignment failed and roll back rotation
        await supabaseClient.from('tasks').delete().eq('id', newTask.id);
        await supabaseClient
          .from('rotating_tasks')
          .update({ current_member_index: originalIndex, updated_at: now.toISOString() })
          .eq('id', rotatingTask.id);
        
        await logRotationEvent({
          previous_index: originalIndex,
          selected_index: selectedIndex,
          next_index: nextIndex,
          chosen_member_id: targetMemberId,
          new_task_id: newTask.id,
          status: 'failed',
          reason: `Assignment failed: ${assignError.message || 'Unknown error'}`
        });
        continue;
      }

      // Log successful rotation
      await logRotationEvent({
        previous_index: originalIndex,
        selected_index: selectedIndex,
        next_index: nextIndex,
        chosen_member_id: targetMemberId,
        new_task_id: newTask.id,
        status: 'success',
        reason: null
      });

      console.log(`✅ Created task ${rotatingTask.name} for member ${targetMemberId}`);
      generatedCount++;

      // Rotation already reserved optimistically above. Proceeding.
      console.log(`🔄 Rotation reserved for ${rotatingTask.name}`);
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
