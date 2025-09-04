import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AddButton } from '@/components/ui/add-button';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { getMemberColorClasses } from '@/lib/utils';
import { Users, Plus } from 'lucide-react';
import { Task, Profile } from '@/types/task';
import { cn } from '@/lib/utils';

interface MemberTasksWidgetProps {
  member: Profile;
  tasks: Task[];
  familyMembers: Profile[];
  profile: Profile;
  onTaskUpdated: () => void;
  onEditTask?: (task: Task) => void;
  onTaskComplete: (task: Task) => void;
  onAddTask: () => void;
}

export const MemberTasksWidget = ({
  member,
  tasks,
  familyMembers,
  profile,
  onEditTask,
  onTaskComplete,
  onAddTask
}: MemberTasksWidgetProps) => {
  const memberColors = getMemberColorClasses(member.color);
  
  const memberTasks = tasks.filter(task => 
    task.assigned_to === member.id || 
    task.assignees?.some(a => a.profile_id === member.id)
  );
  
  const pendingTasks = memberTasks.filter(task => 
    !task.task_completions || task.task_completions.length === 0
  );
  
  const completedTasks = memberTasks.filter(task => 
    task.task_completions && task.task_completions.length > 0
  );

  // Calculate progress percentage
  const progressPercentage = memberTasks.length > 0 
    ? Math.round((completedTasks.length / memberTasks.length) * 100) 
    : 0;

  // Group tasks by task_group field
  const groupTasks = (tasks: Task[]) => {
    const groups = {
      morning: tasks.filter(task => task.task_group === 'morning'),
      midday: tasks.filter(task => task.task_group === 'midday'),
      evening: tasks.filter(task => task.task_group === 'evening'),
      general: tasks.filter(task => !task.task_group || task.task_group === 'general')
    };
    return groups;
  };

  const pendingGroups = groupTasks(pendingTasks);
  const completedGroups = groupTasks(completedTasks);

  const renderTaskGroup = (groupName: string, groupTasks: Task[], groupType: 'pending' | 'completed') => {
    if (groupTasks.length === 0) return null;

    const groupTitle = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    
    return (
      <AccordionItem value={`${groupType}-${groupName}`} key={`${groupType}-${groupName}`}>
        <AccordionTrigger className="text-sm font-medium">
          {groupTitle} ({groupTasks.length})
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {groupTasks.map((task) => (
              <EnhancedTaskItem
                key={task.id}
                task={task}
                allTasks={tasks}
                familyMembers={familyMembers}
                onToggle={(task) => onTaskComplete(task)}
                onEdit={profile.role === 'parent' ? onEditTask : undefined}
                showActions={profile.role === 'parent'}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <Card className={cn("h-full flex flex-col", memberColors.border)} style={{ borderWidth: '2px' }}>
      <CardHeader className="pb-4">
        <CardTitle className={cn("flex items-center gap-2 text-xl", memberColors.text)}>
          <Users className="h-6 w-6" />
          Tasks
        </CardTitle>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        {/* Add Task Button */}
        <AddButton 
          text="Add Task"
          onClick={onAddTask}
          className={cn("border-dashed hover:border-solid w-full", memberColors.border)}
        />
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        {memberTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks assigned</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <Accordion type="multiple" className="space-y-2">
              {/* Pending Tasks */}
              {renderTaskGroup('morning', pendingGroups.morning, 'pending')}
              {renderTaskGroup('midday', pendingGroups.midday, 'pending')}
              {renderTaskGroup('evening', pendingGroups.evening, 'pending')}
              {renderTaskGroup('general', pendingGroups.general, 'pending')}
              
              {/* Show completed tasks if any */}
              {completedTasks.length > 0 && (
                <>
                  {renderTaskGroup('morning', completedGroups.morning.slice(0, 2), 'completed')}
                  {renderTaskGroup('midday', completedGroups.midday.slice(0, 2), 'completed')}
                  {renderTaskGroup('evening', completedGroups.evening.slice(0, 2), 'completed')}
                  {renderTaskGroup('general', completedGroups.general.slice(0, 2), 'completed')}
                </>
              )}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
};