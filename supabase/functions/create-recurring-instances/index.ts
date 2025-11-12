import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          points: number;
          due_date: string | null;
          recurrence_options: any;
          family_id: string;
          created_by: string;
          task_group: string | null;
          completion_rule: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          points?: number;
          due_date?: string | null;
          recurrence_options?: any;
          family_id: string;
          created_by: string;
          task_group?: string | null;
          completion_rule?: string;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          location: string | null;
          start_date: string;
          end_date: string;
          is_all_day: boolean;
          recurrence_options: any;
          family_id: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          location?: string | null;
          start_date: string;
          end_date: string;
          is_all_day?: boolean;
          recurrence_options?: any;
          family_id: string;
          created_by: string;
        };
      };
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { type, parentId } = await req.json();

    if (type === 'task') {
      // Get the original task
      const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', parentId)
        .single();

      if (!task?.recurrence_options?.enabled) {
        return new Response(
          JSON.stringify({ success: false, error: 'No recurrence options' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate instances based on recurrence rules
      const instances = [];
      const startDate = new Date(task.due_date || new Date());
      const rule = task.recurrence_options.rule;
      
      console.log('Generating task instances with rule:', rule);
      
      // Determine how many instances to create
      let maxInstances = 100; // Default safety limit
      if (rule.endType === 'after_count' && rule.endCount) {
        maxInstances = rule.endCount;
        console.log('Creating', maxInstances, 'task instances based on endCount');
      } else if (rule.endType === 'on_date' && rule.endDate) {
        console.log('Creating task instances until', rule.endDate);
      } else {
        maxInstances = 365;
        console.log('Creating task instances for next year (365 max)');
      }
      
      let currentDate = new Date(startDate);
      let instanceCount = 0;
      
      while (instanceCount < maxInstances) {
        const nextDate = new Date(currentDate);
        
        switch (rule.frequency) {
          case 'daily':
            nextDate.setDate(nextDate.getDate() + rule.interval);
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + (7 * rule.interval));
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + rule.interval);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + rule.interval);
            break;
        }
        
        // Check if we've exceeded the end date
        if (rule.endType === 'on_date' && rule.endDate) {
          const endDateLimit = new Date(rule.endDate);
          if (nextDate > endDateLimit) {
            console.log('Reached task end date limit:', rule.endDate);
            break;
          }
        }
        
        instanceCount++;

        instances.push({
          title: task.title,
          description: task.description,
          points: task.points,
          due_date: nextDate.toISOString(),
          family_id: task.family_id,
          created_by: task.created_by,
          task_group: task.task_group === 'afternoon' ? 'evening' : task.task_group,
          completion_rule: task.completion_rule,
          recurrence_options: null // Future instances don't need recurrence
        });
        
        currentDate = nextDate;
      }
      
      console.log('Generated', instances.length, 'recurring task instances');

      const { error } = await supabase.from('tasks').insert(instances);
      
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, created: instances.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'event') {
      // Get the original event
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', parentId)
        .single();

      if (!event?.recurrence_options?.enabled) {
        return new Response(
          JSON.stringify({ success: false, error: 'No recurrence options' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate instances based on recurrence rules
      const instances = [];
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      const duration = endDate.getTime() - startDate.getTime();
      const rule = event.recurrence_options.rule;
      
      console.log('Generating instances with rule:', rule);
      
      // Determine how many instances to create
      let maxInstances = 100; // Default safety limit
      if (rule.endType === 'after_count' && rule.endCount) {
        maxInstances = rule.endCount;
        console.log('Creating', maxInstances, 'instances based on endCount');
      } else if (rule.endType === 'on_date' && rule.endDate) {
        // We'll check dates in the loop for date-based endings
        console.log('Creating instances until', rule.endDate);
      } else {
        // 'never' - create a reasonable number for the next year
        maxInstances = 365;
        console.log('Creating instances for next year (365 max)');
      }
      
      let currentDate = new Date(startDate);
      let instanceCount = 0;
      
      while (instanceCount < maxInstances) {
        // Calculate next occurrence
        const nextStartDate = new Date(currentDate);
        
        switch (rule.frequency) {
          case 'daily':
            nextStartDate.setDate(nextStartDate.getDate() + rule.interval);
            break;
          case 'weekly':
            nextStartDate.setDate(nextStartDate.getDate() + (7 * rule.interval));
            break;
          case 'monthly':
            nextStartDate.setMonth(nextStartDate.getMonth() + rule.interval);
            break;
          case 'yearly':
            nextStartDate.setFullYear(nextStartDate.getFullYear() + rule.interval);
            break;
        }
        
        // Check if we've exceeded the end date
        if (rule.endType === 'on_date' && rule.endDate) {
          const endDateLimit = new Date(rule.endDate);
          if (nextStartDate > endDateLimit) {
            console.log('Reached end date limit:', rule.endDate);
            break;
          }
        }
        
        const nextEndDate = new Date(nextStartDate.getTime() + duration);
        instanceCount++;

        instances.push({
          title: event.title,
          description: event.description,
          location: event.location,
          start_date: nextStartDate.toISOString(),
          end_date: nextEndDate.toISOString(),
          is_all_day: event.is_all_day,
          family_id: event.family_id,
          created_by: event.created_by,
          recurrence_options: null // Future instances don't need recurrence
        });
        
        currentDate = nextStartDate;
      }
      
      console.log('Generated', instances.length, 'recurring instances');

      const { error } = await supabase.from('events').insert(instances);
      
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, created: instances.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid type' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});