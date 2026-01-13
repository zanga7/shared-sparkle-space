import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { TaskGroupsList } from '@/components/tasks/TaskGroupsList';
import { cn } from '@/lib/utils';
import { useMemberColor } from '@/hooks/useMemberColor';
import { Task, Profile } from '@/types/task';
import { DropResult } from '@hello-pangea/dnd';
import { TaskGroup } from '@/types/taskGroup';

interface MemberTaskColumnProps {
  member: Profile;
  memberTasks: Task[];
  completedTasks: Task[];
  allTasks: Task[];
  familyMembers: Profile[];
  onTaskToggle: (task: Task, columnMemberId?: string) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onAddTask: (memberId: string, group?: TaskGroup) => void;
  onAddTaskForMember: (memberId: string) => void;
  onDragEnd: (result: DropResult) => void;
  showActions: boolean;
  isCompleting?: (taskId: string) => boolean;
}

export function MemberTaskColumn({
  member,
  memberTasks,
  completedTasks,
  allTasks,
  familyMembers,
  onTaskToggle,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onAddTaskForMember,
  onDragEnd,
  showActions,
  isCompleting,
}: MemberTaskColumnProps) {
  const { styles: colorStyles, hex: colorHex } = useMemberColor(member.color);

  const progressPercentage = memberTasks.length > 0
    ? Math.round((completedTasks.length / memberTasks.length) * 100)
    : 0;

  return (
    <Card 
      className="h-fit w-full group"
      style={colorStyles.bg10}
    >
      <CardHeader 
        className="pb-3 border-b"
        style={colorStyles.border}
      >
        <div className="flex items-center gap-3">
          <UserAvatar
            name={member.display_name}
            color={member.color}
            avatarIcon={member.avatar_url || undefined}
            size="md"
            className="sm:h-10 sm:w-10"
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg truncate">
              {member.display_name}
            </CardTitle>
          </div>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-muted">
          <div
            className="absolute inset-0 h-full transition-all duration-300"
            style={{
              ...colorStyles.accent,
              width: `${progressPercentage}%`,
            }}
          />
        </div>
        {showActions && (
          <div className="pt-3">
            <AddButton
              className="text-xs"
              style={{ ...colorStyles.border, ...colorStyles.text }}
              text="Add Task"
              showIcon={true}
              onClick={() => onAddTaskForMember(member.id)}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <TaskGroupsList
          tasks={memberTasks}
          allTasks={allTasks}
          familyMembers={familyMembers}
          onTaskToggle={(task) => onTaskToggle(task, member.id)}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onAddTask={(group) => onAddTask(member.id, group)}
          onDragEnd={onDragEnd}
          showActions={showActions}
          memberId={member.id}
          memberColor={member.color}
          droppableIdPrefix={`${member.id}-`}
          isCompleting={isCompleting}
        />
      </CardContent>

    </Card>
  );
}
