import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { Calendar } from 'lucide-react';
import { Task, Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { getMemberColorClasses } from '@/lib/utils';

interface MemberTodaysTasksProps {
  member: Profile;
  tasks: Task[];
  familyMembers: Profile[];
  profile: Profile;
  onEditTask?: (task: Task) => void;
  onTaskComplete: (task: Task) => void;
}

export const MemberTodaysTasks = ({
  member,
  tasks,
  familyMembers,
  profile,
  onEditTask,
  onTaskComplete
}: MemberTodaysTasksProps) => {
  const memberColors = getMemberColorClasses(member.color);
  
  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Filter tasks assigned to this member that are due/occurring today
  const todaysTasks = tasks.filter(task => {
    const isAssigned = task.assigned_to === member.id || 
                      task.assignees?.some(a => a.profile_id === member.id);
    
    if (!isAssigned) return false;
    
    // For virtual/recurring tasks, use occurrence_date; for regular tasks, use due_date
    const dateToCheck = (task as any).isVirtual && (task as any).occurrence_date
      ? (task as any).occurrence_date
      : task.due_date;
    
    if (!dateToCheck) return false;
    
    const taskDate = new Date(dateToCheck);
    return taskDate >= today && taskDate < tomorrow;
  });

  return (
    <Card className={cn("h-full", memberColors.bg10)}>
      <CardHeader className="pb-4">
        <CardTitle className={cn("flex items-center gap-2 text-xl", memberColors.text)}>
          <Calendar className="h-6 w-6" />
          Today's Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {todaysTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks due today</p>
          </div>
        ) : (
          todaysTasks.map((task) => (
            <EnhancedTaskItem
              key={task.id}
              task={task}
              allTasks={tasks}
              familyMembers={familyMembers}
              onToggle={(task) => onTaskComplete(task)}
              onEdit={profile.role === 'parent' ? onEditTask : undefined}
              showActions={profile.role === 'parent'}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};