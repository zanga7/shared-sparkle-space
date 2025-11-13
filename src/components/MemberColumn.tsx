import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { TaskGroupsList } from '@/components/tasks/TaskGroupsList';
import { cn } from '@/lib/utils';
import { useMemberColor } from '@/hooks/useMemberColor';

interface MemberColumnProps {
  member: any;
  memberTasks: any[];
  completedTasks: any[];
  allTasks: any[];
  familyMembers: any[];
  onTaskToggle: (taskId: string, memberId: string) => Promise<void>;
  onEditTask?: (task: any) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddTask: (group?: string) => void;
  onAddTaskForMember: (memberId: string) => void;
  onDragEnd: (result: any) => Promise<void>;
  showActions: boolean;
}

export function MemberColumn({
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
}: MemberColumnProps) {
  const { styles: colorStyles, hex: colorHex } = useMemberColor(member.color);

  return (
    <Card
      key={member.id}
      className="flex-shrink-0 w-72 sm:w-80 h-fit group"
      style={colorStyles.bg10}
    >
      <CardHeader className="pb-3 border-b" style={colorStyles.border}>
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
        <div style={colorStyles.bg} className="h-3 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              ...colorStyles.accent,
              width: memberTasks.length > 0
                ? `${Math.round((completedTasks.length / memberTasks.length) * 100)}%`
                : '0%',
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <TaskGroupsList
          tasks={memberTasks}
          allTasks={allTasks}
          familyMembers={familyMembers}
          onTaskToggle={onTaskToggle}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onAddTask={onAddTask}
          onDragEnd={onDragEnd}
          showActions={showActions}
          memberId={member.id}
          memberColor={member.color}
          droppableIdPrefix={`${member.id}-`}
        />
      </CardContent>

      {showActions && (
        <div className="px-4 pb-4">
          <AddButton
            className="w-full text-xs opacity-0 group-hover:opacity-75 transition-opacity"
            style={{ ...colorStyles.border, ...colorStyles.text }}
            text="Add Task"
            showIcon={true}
            onClick={() => onAddTaskForMember(member.id)}
          />
        </div>
      )}
    </Card>
  );
}
