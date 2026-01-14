import { useState, useEffect } from 'react';
import { CheckSquare, Repeat, RotateCcw, Plus, X, Link, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { GoalLinkedTask } from '@/types/goal';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Profile } from '@/types/task';

interface AvailableTask {
  id: string;
  title: string;
  type: 'one_off' | 'recurring' | 'rotating';
}

interface TaskLinkingSectionProps {
  familyId: string | null;
  linkedTasks?: GoalLinkedTask[];
  selectedTaskIds: string[];
  selectedSeriesIds: string[];
  selectedRotatingIds: string[];
  onTasksChange: (taskIds: string[]) => void;
  onSeriesChange: (seriesIds: string[]) => void;
  onRotatingChange: (rotatingIds: string[]) => void;
  onUnlink?: (linkId: string) => void;
  milestoneId?: string;
  className?: string;
  familyMembers?: Profile[];
  profileId?: string;
  onNewTaskCreated?: (taskId: string) => void;
}

export function TaskLinkingSection({
  familyId,
  linkedTasks = [],
  selectedTaskIds,
  selectedSeriesIds,
  selectedRotatingIds,
  onTasksChange,
  onSeriesChange,
  onRotatingChange,
  onUnlink,
  milestoneId,
  className,
  familyMembers = [],
  profileId,
  onNewTaskCreated
}: TaskLinkingSectionProps) {
  const [availableTasks, setAvailableTasks] = useState<AvailableTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string>('');
  const [showCreateTask, setShowCreateTask] = useState(false);

  const fetchAvailableTasks = async () => {
    if (!familyId) return;
    
    setLoading(true);
    try {
      type TaskRow = { id: string; title: string };
      type SeriesRow = { id: string; title: string };
      type RotatingRow = { id: string; name: string };

      const [tasksRes, seriesRes, rotatingRes] = await Promise.all([
        supabase
          .from('tasks' as any)
          .select('id, title')
          .eq('family_id', familyId)
          .is('hidden_at', null),
        supabase
          .from('task_series' as any)
          .select('id, title')
          .eq('family_id', familyId)
          .eq('is_active', true),
        supabase
          .from('rotating_tasks' as any)
          .select('id, name')
          .eq('family_id', familyId)
          .eq('is_active', true),
      ]);

      const tasksData = (tasksRes.data as unknown as TaskRow[]) || [];
      const seriesData = (seriesRes.data as unknown as SeriesRow[]) || [];
      const rotatingData = (rotatingRes.data as unknown as RotatingRow[]) || [];

      const allTasks: AvailableTask[] = [];

      tasksData.forEach((t) => {
        allTasks.push({ id: `task:${t.id}`, title: t.title, type: 'one_off' });
      });

      seriesData.forEach((s) => {
        allTasks.push({ id: `series:${s.id}`, title: s.title, type: 'recurring' });
      });

      rotatingData.forEach((r) => {
        allTasks.push({ id: `rotating:${r.id}`, title: r.name, type: 'rotating' });
      });
      setAvailableTasks(allTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableTasks();
  }, [familyId]);

  const handleAddTask = () => {
    if (!selectedToAdd) return;
    
    const [type, id] = selectedToAdd.split(':');
    
    if (type === 'task' && !selectedTaskIds.includes(id)) {
      onTasksChange([...selectedTaskIds, id]);
    } else if (type === 'series' && !selectedSeriesIds.includes(id)) {
      onSeriesChange([...selectedSeriesIds, id]);
    } else if (type === 'rotating' && !selectedRotatingIds.includes(id)) {
      onRotatingChange([...selectedRotatingIds, id]);
    }
    
    setSelectedToAdd('');
  };

  const handleRemoveNew = (type: string, id: string) => {
    if (type === 'task') {
      onTasksChange(selectedTaskIds.filter(i => i !== id));
    } else if (type === 'series') {
      onSeriesChange(selectedSeriesIds.filter(i => i !== id));
    } else if (type === 'rotating') {
      onRotatingChange(selectedRotatingIds.filter(i => i !== id));
    }
  };

  const handleTaskCreated = (taskId?: string) => {
    setShowCreateTask(false);
    // Refresh available tasks to include the new one
    fetchAvailableTasks();
    
    // Auto-attach the new task to the goal if callback provided
    if (taskId && onNewTaskCreated) {
      onNewTaskCreated(taskId);
    } else if (taskId) {
      // If no callback, add to selected tasks
      onTasksChange([...selectedTaskIds, taskId]);
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'recurring':
        return <Repeat className="h-4 w-4 text-blue-500" />;
      case 'rotating':
        return <RotateCcw className="h-4 w-4 text-purple-500" />;
      default:
        return <CheckSquare className="h-4 w-4 text-primary" />;
    }
  };

  const getTaskTypeBadge = (type: string) => {
    switch (type) {
      case 'recurring':
        return <Badge variant="outline" className="text-xs">Recurring</Badge>;
      case 'rotating':
        return <Badge variant="outline" className="text-xs">Rotating</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">One-off</Badge>;
    }
  };

  // Get selected tasks info from available tasks
  const selectedNewTasks = availableTasks.filter(t => {
    const [type, id] = t.id.split(':');
    if (type === 'task') return selectedTaskIds.includes(id);
    if (type === 'series') return selectedSeriesIds.includes(id);
    if (type === 'rotating') return selectedRotatingIds.includes(id);
    return false;
  });

  // Filter linked tasks for this milestone (or no milestone if not specified)
  const filteredLinkedTasks = milestoneId 
    ? linkedTasks.filter(lt => lt.milestone_id === milestoneId)
    : linkedTasks;

  // Filter out already linked or selected tasks
  const linkedTaskIds = filteredLinkedTasks.map(lt => 
    lt.task_id ? `task:${lt.task_id}` : 
    lt.task_series_id ? `series:${lt.task_series_id}` : 
    lt.rotating_task_id ? `rotating:${lt.rotating_task_id}` : ''
  ).filter(Boolean);
  
  const selectedIds = [
    ...selectedTaskIds.map(id => `task:${id}`),
    ...selectedSeriesIds.map(id => `series:${id}`),
    ...selectedRotatingIds.map(id => `rotating:${id}`),
  ];
  
  const availableToAdd = availableTasks.filter(t => 
    !linkedTaskIds.includes(t.id) && !selectedIds.includes(t.id)
  );

  const canCreateTask = familyId && profileId && familyMembers.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Link className="h-4 w-4" />
          Linked Tasks
          {milestoneId && <Badge variant="secondary" className="text-xs">For this milestone</Badge>}
        </Label>
        <p className="text-xs text-muted-foreground">
          Link existing tasks to track progress toward this goal
        </p>
      </div>

      {/* Existing linked tasks */}
      {filteredLinkedTasks.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Currently linked</span>
          {filteredLinkedTasks.map((link) => (
            <div 
              key={link.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {getTaskIcon(link.task_type || 'one_off')}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">
                  {link.task_title || 'Unknown Task'}
                </div>
                {getTaskTypeBadge(link.task_type || 'one_off')}
              </div>
              {onUnlink && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onUnlink(link.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Newly selected tasks */}
      {selectedNewTasks.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">To be linked</span>
          {selectedNewTasks.map((task) => {
            const [type, id] = task.id.split(':');
            return (
              <div 
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20"
              >
                {getTaskIcon(task.type)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{task.title}</div>
                  {getTaskTypeBadge(task.type)}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveNew(type, id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add task selector */}
      <div className="flex gap-2">
        <Select value={selectedToAdd} onValueChange={setSelectedToAdd} disabled={loading}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={loading ? 'Loading tasks...' : 'Select a task to link...'} />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.length === 0 ? (
              <SelectItem value="none" disabled>No more tasks available</SelectItem>
            ) : (
              availableToAdd.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  <div className="flex items-center gap-2">
                    {getTaskIcon(task.type)}
                    <span>{task.title}</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {task.type === 'recurring' ? 'Recurring' : task.type === 'rotating' ? 'Rotating' : 'One-off'}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button 
          variant="outline" 
          onClick={handleAddTask}
          disabled={!selectedToAdd || selectedToAdd === 'none'}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Create new task button */}
      {canCreateTask && (
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setShowCreateTask(true)}
        >
          <FilePlus className="h-4 w-4 mr-2" />
          Create New Task
        </Button>
      )}

      {filteredLinkedTasks.length === 0 && selectedNewTasks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No tasks linked yet. Task completions will count toward goal progress.
        </p>
      )}

      {/* Create Task Dialog */}
      {canCreateTask && (
        <AddTaskDialog
          familyMembers={familyMembers}
          familyId={familyId}
          profileId={profileId}
          onTaskCreated={handleTaskCreated}
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
        />
      )}
    </div>
  );
}
