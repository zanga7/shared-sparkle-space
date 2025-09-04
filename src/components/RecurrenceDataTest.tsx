import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const RecurrenceDataTest = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Get tasks with recurrence
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, recurrence_options')
        .not('recurrence_options', 'is', null)
        .limit(5);

      // Get events with recurrence  
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, recurrence_options')
        .not('recurrence_options', 'is', null)
        .limit(5);

      setTasks(tasksData || []);
      setEvents(eventsData || []);
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Tasks with Recurrence Data</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground">No tasks with recurrence found</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="border p-2 rounded">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {JSON.stringify(task.recurrence_options)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events with Recurrence Data</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground">No events with recurrence found</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="border p-2 rounded">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {JSON.stringify(event.recurrence_options)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};