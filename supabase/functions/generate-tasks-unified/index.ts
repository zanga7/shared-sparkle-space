import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskSeries {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  points: number;
  assigned_to: string | null;
  recurring_frequency: string;
  recurring_interval: number;
  recurring_days_of_week: number[] | null;
  recurring_end_date: string | null;
  is_active: boolean;
  last_generated_through: string | null;
  next_due_date: string | null;
  created_by: string;
  created_at: string;
  start_date: string | null;
}

interface RotatingTask {
  id: string;
  family_id: string;
  name: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  weekly_days: number[] | null;
  monthly_day: number | null;
  member_order: string[];
  current_member_index: number;
  points: number;
  description: string | null;
  is_active: boolean;
  is_paused: boolean;
  created_by: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { family_id, window_start, window_end } = await req.json();
    
    if (!family_id || !window_start || !window_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: family_id, window_start, window_end' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const startTime = Date.now();
    const windowStart = new Date(window_start);
    const windowEnd = new Date(window_end);
    
    console.log(`Generating tasks for family ${family_id} from ${window_start} to ${window_end}`);

    // Fetch active task series
    const { data: taskSeries, error: seriesError } = await supabaseClient
      .from('task_series')
      .select('*')
      .eq('family_id', family_id)
      .eq('is_active', true);

    if (seriesError) throw seriesError;

    // Fetch active rotating tasks
    const { data: rotatingTasks, error: rotatingError } = await supabaseClient
      .from('rotating_tasks')
      .select('*')
      .eq('family_id', family_id)
      .eq('is_active', true)
      .eq('is_paused', false);

    if (rotatingError) throw rotatingError;

    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // Generate recurring tasks
    for (const series of taskSeries || []) {
      try {
        const result = await generateRecurringTasks(supabaseClient, series, windowStart, windowEnd);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        
        // Update watermark
        await supabaseClient
          .from('task_series')
          .update({ last_generated_through: windowEnd.toISOString().split('T')[0] })
          .eq('id', series.id);
          
      } catch (error) {
        console.error(`Error generating tasks for series ${series.id}:`, error);
        errors.push(`Series ${series.title}: ${error.message}`);
      }
    }

    // Generate rotating tasks
    for (const rotatingTask of rotatingTasks || []) {
      try {
        const result = await generateRotatingTasks(supabaseClient, rotatingTask, windowStart, windowEnd);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
      } catch (error) {
        console.error(`Error generating rotating tasks for ${rotatingTask.id}:`, error);
        errors.push(`Rotating ${rotatingTask.name}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;

    // Log generation results
    await supabaseClient
      .from('task_generation_logs')
      .insert({
        family_id,
        window_start: windowStart.toISOString().split('T')[0],
        window_end: windowEnd.toISOString().split('T')[0],
        inserted_count: totalInserted,
        skipped_count: totalSkipped,
        error_message: errors.length > 0 ? errors.join('; ') : null,
        duration_ms: duration
      });

    console.log(`Generation complete: ${totalInserted} inserted, ${totalSkipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted_count: totalInserted,
        skipped_count: totalSkipped,
        errors,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in generate-tasks-unified:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function generateRecurringTasks(
  supabaseClient: any,
  series: TaskSeries,
  windowStart: Date,
  windowEnd: Date
): Promise<{ inserted: number; skipped: number }> {
  
  const occurrences = calculateOccurrences(series, windowStart, windowEnd);
  const tasksToInsert = [];
  
  for (const occurrence of occurrences) {
    // Check if task already exists (ON CONFLICT replacement)
    const dateStr = occurrence.toISOString();
    const { data: existing } = await supabaseClient
      .from('tasks')
      .select('id')
      .eq('series_id', series.id)
      .eq('due_date', dateStr)
      .single();
    
    if (!existing) {
      tasksToInsert.push({
        family_id: series.family_id,
        title: series.title,
        description: series.description,
        points: series.points,
        assigned_to: series.assigned_to,
        due_date: dateStr,
        created_by: series.created_by,
        series_id: series.id,
        is_repeating: true,
        task_group: 'recurring',
        completion_rule: 'everyone'
      });
    }
  }

  if (tasksToInsert.length > 0) {
    const { error } = await supabaseClient
      .from('tasks')
      .insert(tasksToInsert);
    
    if (error) throw error;
  }

  return {
    inserted: tasksToInsert.length,
    skipped: occurrences.length - tasksToInsert.length
  };
}

async function generateRotatingTasks(
  supabaseClient: any,
  rotatingTask: RotatingTask,
  windowStart: Date,
  windowEnd: Date
): Promise<{ inserted: number; skipped: number }> {
  
  const occurrences = calculateRotatingOccurrences(rotatingTask, windowStart, windowEnd);
  let inserted = 0;
  let skipped = 0;
  
  for (const occurrence of occurrences) {
    const currentMemberId = rotatingTask.member_order[rotatingTask.current_member_index];
    const dateStr = occurrence.toISOString();
    
    // Check if task already exists
    const { data: existing } = await supabaseClient
      .from('tasks')
      .select('id')
      .eq('title', rotatingTask.name)
      .eq('assigned_to', currentMemberId)
      .eq('due_date', dateStr)
      .single();
    
    if (!existing) {
      const { error } = await supabaseClient
        .from('tasks')
        .insert({
          family_id: rotatingTask.family_id,
          title: rotatingTask.name,
          description: rotatingTask.description,
          points: rotatingTask.points,
          assigned_to: currentMemberId,
          due_date: dateStr,
          created_by: rotatingTask.created_by,
          is_repeating: false,
          task_group: 'rotating',
          completion_rule: 'everyone'
        });
      
      if (error) throw error;
      inserted++;
      
      // Rotate to next member
      const nextIndex = (rotatingTask.current_member_index + 1) % rotatingTask.member_order.length;
      await supabaseClient
        .from('rotating_tasks')
        .update({ current_member_index: nextIndex })
        .eq('id', rotatingTask.id);
        
      rotatingTask.current_member_index = nextIndex; // Update for next iteration
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

function calculateOccurrences(series: TaskSeries, start: Date, end: Date): Date[] {
  const occurrences: Date[] = [];
  let current = new Date(series.start_date || series.created_at);
  
  // Normalize to start of day UTC
  current = new Date(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()));
  const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
  
  if (current < start) {
    current = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  }

  let iterations = 0;
  const maxIterations = 1000; // Safety net

  while (current <= endDate && iterations < maxIterations) {
    iterations++;
    
    // Check if within series end date
    if (series.recurring_end_date && current > new Date(series.recurring_end_date)) {
      break;
    }

    // Check if this occurrence matches the recurrence pattern
    if (matchesRecurrencePattern(current, series)) {
      occurrences.push(new Date(current));
    }

    // Move to next potential occurrence
    current = getNextPotentialDate(current, series);
  }

  return occurrences;
}

function matchesRecurrencePattern(date: Date, series: TaskSeries): boolean {
  switch (series.recurring_frequency) {
    case 'daily':
      return true; // Daily tasks match every day
      
    case 'weekly':
      if (series.recurring_days_of_week && series.recurring_days_of_week.length > 0) {
        return series.recurring_days_of_week.includes(date.getUTCDay());
      }
      return date.getUTCDay() === 1; // Default to Monday
      
    case 'monthly':
      return date.getUTCDate() === (series.start_date ? new Date(series.start_date).getUTCDate() : 1);
      
    default:
      return false;
  }
}

function getNextPotentialDate(current: Date, series: TaskSeries): Date {
  const next = new Date(current);
  
  switch (series.recurring_frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + (series.recurring_interval || 1));
      break;
      
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 1); // Check each day for weekly patterns
      break;
      
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + (series.recurring_interval || 1));
      break;
      
    default:
      next.setUTCDate(next.getUTCDate() + 1);
  }
  
  return next;
}

function calculateRotatingOccurrences(rotatingTask: RotatingTask, start: Date, end: Date): Date[] {
  const occurrences: Date[] = [];
  let current = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

  while (current <= endDate) {
    if (shouldGenerateRotatingTask(rotatingTask, current)) {
      occurrences.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return occurrences;
}

function shouldGenerateRotatingTask(rotatingTask: RotatingTask, date: Date): boolean {
  const dayOfWeek = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();

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