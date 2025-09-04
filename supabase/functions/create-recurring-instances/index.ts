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

      // Generate next 5 instances as example
      const instances = [];
      const startDate = new Date(task.due_date || new Date());
      
      for (let i = 1; i <= 5; i++) {
        const nextDate = new Date(startDate);
        
        switch (task.recurrence_options.rule.frequency) {
          case 'daily':
            nextDate.setDate(nextDate.getDate() + (i * task.recurrence_options.rule.interval));
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + (i * 7 * task.recurrence_options.rule.interval));
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + (i * task.recurrence_options.rule.interval));
            break;
        }

        instances.push({
          title: `${task.title} (${i})`,
          description: task.description,
          points: task.points,
          due_date: nextDate.toISOString(),
          family_id: task.family_id,
          created_by: task.created_by,
          task_group: task.task_group,
          completion_rule: task.completion_rule,
          recurrence_options: null // Future instances don't need recurrence
        });
      }

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

      // Generate next 5 instances as example
      const instances = [];
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      const duration = endDate.getTime() - startDate.getTime();
      
      for (let i = 1; i <= 5; i++) {
        const nextStartDate = new Date(startDate);
        
        switch (event.recurrence_options.rule.frequency) {
          case 'daily':
            nextStartDate.setDate(nextStartDate.getDate() + (i * event.recurrence_options.rule.interval));
            break;
          case 'weekly':
            nextStartDate.setDate(nextStartDate.getDate() + (i * 7 * event.recurrence_options.rule.interval));
            break;
          case 'monthly':
            nextStartDate.setMonth(nextStartDate.getMonth() + (i * event.recurrence_options.rule.interval));
            break;
        }

        const nextEndDate = new Date(nextStartDate.getTime() + duration);

        instances.push({
          title: `${event.title} (${i})`,
          description: event.description,
          location: event.location,
          start_date: nextStartDate.toISOString(),
          end_date: nextEndDate.toISOString(),
          is_all_day: event.is_all_day,
          family_id: event.family_id,
          created_by: event.created_by,
          recurrence_options: null // Future instances don't need recurrence
        });
      }

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