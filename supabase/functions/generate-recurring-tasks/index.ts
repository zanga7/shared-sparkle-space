import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      task_series: any
      tasks: any
      profiles: any
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all active task series that need new tasks generated
    const { data: taskSeries, error: seriesError } = await supabaseClient
      .from('task_series')
      .select('*')
      .eq('is_active', true)
      .or('last_generated_date.is.null,next_due_date.lte.' + new Date().toISOString())

    if (seriesError) {
      console.error('Error fetching task series:', seriesError)
      return new Response(JSON.stringify({ error: 'Failed to fetch task series' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let generatedCount = 0

    for (const series of taskSeries || []) {
      // Calculate next due date based on recurring frequency
      const nextDueDate = calculateNextDueDate(series)
      
      if (!nextDueDate) continue

      // Check if we should stop generating (past end date)
      if (series.recurring_end_date && nextDueDate > new Date(series.recurring_end_date)) {
        // Deactivate the series
        await supabaseClient
          .from('task_series')
          .update({ is_active: false })
          .eq('id', series.id)
        continue
      }

      // Create the new task instance
      const { error: taskError } = await supabaseClient
        .from('tasks')
        .insert({
          family_id: series.family_id,
          title: series.title,
          description: series.description,
          points: series.points,
          assigned_to: series.assigned_to,
          due_date: nextDueDate.toISOString(),
          created_by: series.created_by,
          series_id: series.id,
          task_group: series.task_group === 'afternoon' ? 'evening' : series.task_group,
          is_repeating: false // Individual instances are not repeating
        })

      if (taskError) {
        console.error('Error creating task:', taskError)
        continue
      }

      // Calculate the next due date after this one
      const followingDueDate = calculateNextDueDate({
        ...series,
        last_generated_date: nextDueDate.toISOString()
      })

      // Update the series with generation info
      await supabaseClient
        .from('task_series')
        .update({
          last_generated_date: nextDueDate.toISOString(),
          next_due_date: followingDueDate?.toISOString() || null
        })
        .eq('id', series.id)

      generatedCount++
    }

    return new Response(JSON.stringify({ 
      message: `Generated ${generatedCount} recurring tasks`,
      count: generatedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in generate-recurring-tasks function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function calculateNextDueDate(series: any): Date | null {
  const now = new Date()
  const baseDate = series.last_generated_date ? new Date(series.last_generated_date) : now
  
  switch (series.recurring_frequency) {
    case 'daily':
      const dailyNext = new Date(baseDate)
      dailyNext.setDate(dailyNext.getDate() + series.recurring_interval)
      return dailyNext

    case 'weekly':
      const weeklyNext = new Date(baseDate)
      
      if (series.recurring_days_of_week && series.recurring_days_of_week.length > 0) {
        // Find next occurrence of specified days
        let daysToAdd = 1
        const maxDays = 7 * series.recurring_interval
        
        while (daysToAdd <= maxDays) {
          const testDate = new Date(baseDate)
          testDate.setDate(testDate.getDate() + daysToAdd)
          
          if (series.recurring_days_of_week.includes(testDate.getDay())) {
            return testDate
          }
          daysToAdd++
        }
      } else {
        // Default to same day next week(s)
        weeklyNext.setDate(weeklyNext.getDate() + (7 * series.recurring_interval))
      }
      return weeklyNext

    case 'monthly':
      const monthlyNext = new Date(baseDate)
      monthlyNext.setMonth(monthlyNext.getMonth() + series.recurring_interval)
      return monthlyNext

    default:
      return null
  }
}