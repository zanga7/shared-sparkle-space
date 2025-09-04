import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { MemberTodaysTasks } from '@/components/MemberTodaysTasks';
import { MemberPersonalLists } from '@/components/MemberPersonalLists';
import { MemberRewardsStack } from '@/components/MemberRewardsStack';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EventDialog } from '@/components/EventDialog';
import { getMemberColorClasses } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Users, Calendar, List, Gift, Plus } from 'lucide-react';
import { Task, Profile } from '@/types/task';
import { cn } from '@/lib/utils';

interface MemberDashboardProps {
  member: Profile;
  tasks: Task[];
  familyMembers: Profile[];
  profile: Profile;
  onTaskUpdated: () => void;
  onEditTask?: (task: Task) => void;
  onTaskComplete: (task: Task) => void;
  activeMemberId: string | null;
  dashboardMode: string;
}

const WIDGET_SECTIONS = [
  { id: 'tasks', title: 'Tasks', icon: Users },
  { id: 'schedule', title: 'Today\'s Tasks', icon: Calendar },
  { id: 'lists', title: 'My Lists', icon: List },
  { id: 'rewards', title: 'Rewards', icon: Gift },
];

export const MemberDashboard = ({
  member,
  tasks,
  familyMembers,
  profile,
  onTaskUpdated,
  onEditTask,
  onTaskComplete,
  activeMemberId,
  dashboardMode
}: MemberDashboardProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', dragFree: false });
  const [activeWidget, setActiveWidget] = useState(0);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const scrollToWidget = (index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
      setActiveWidget(index);
    }
  };

  const renderMemberHeader = () => (
    <div className={cn(
      "text-center py-6 sm:py-8 rounded-lg border-2 mb-6",
      memberColors.border,
      memberColors.bgSoft
    )}>
      <UserAvatar 
        name={member.display_name} 
        color={member.color} 
        size="lg" 
        className="mx-auto mb-4" 
      />
      <h1 className={cn(
        "text-3xl sm:text-4xl font-bold mb-4",
        memberColors.text
      )}>
        {member.display_name}'s Dashboard
      </h1>
      <div className="flex justify-center items-center gap-4 mb-6">
        <Badge variant="outline" className="text-lg px-4 sm:px-6 py-2">
          {member.total_points} points
        </Badge>
        <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-lg px-4 sm:px-6 py-2">
          {member.role}
        </Badge>
      </div>
      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <AddButton 
          text="Add Task"
          onClick={() => setIsTaskDialogOpen(true)}
          className={cn("border-dashed hover:border-solid", memberColors.border)}
        />
        <AddButton 
          text="Add Event"
          onClick={() => setIsEventDialogOpen(true)}
          className={cn("border-dashed hover:border-solid", memberColors.border)}
        />
      </div>
    </div>
  );

  const renderTasksWidget = () => (
    <Card className={cn("h-full", memberColors.border)} style={{ borderWidth: '2px' }}>
      <CardHeader className="pb-4">
        <CardTitle className={cn("flex items-center gap-2 text-xl", memberColors.text)}>
          <Users className="h-6 w-6" />
          Tasks ({pendingTasks.length} pending, {completedTasks.length} completed)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks assigned</p>
          </div>
        ) : (
          <>
            {pendingTasks.map((task) => (
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
            {completedTasks.slice(0, 3).map((task) => (
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
            {completedTasks.length > 3 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                And {completedTasks.length - 3} more completed tasks...
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  const renderScheduleWidget = () => (
    <MemberTodaysTasks
      member={member}
      tasks={tasks}
      familyMembers={familyMembers}
      profile={profile}
      onEditTask={onEditTask}
      onTaskComplete={onTaskComplete}
    />
  );

  const renderListsWidget = () => (
    <MemberPersonalLists
      member={member}
      profile={profile}
    />
  );

  const renderRewardsWidget = () => (
    <MemberRewardsStack member={member} />
  );

  const widgets = [
    renderTasksWidget(),
    renderScheduleWidget(),
    renderListsWidget(),
    renderRewardsWidget()
  ];

  if (isMobile) {
    return (
      <div className="w-full max-w-7xl mx-auto">
        {renderMemberHeader()}
        
        {/* Mobile Navigation Dots */}
        <div className="flex justify-center gap-2 mb-4">
          {WIDGET_SECTIONS.map((section, index) => (
            <button
              key={section.id}
              onClick={() => scrollToWidget(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-colors",
                activeWidget === index ? memberColors.accent : "bg-muted"
              )}
              aria-label={`Go to ${section.title}`}
            />
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {widgets.map((widget, index) => (
              <div key={index} className="flex-[0_0_100%] px-2">
                <div className="h-[calc(100vh-300px)]">
                  {widget}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToWidget(Math.max(0, activeWidget - 1))}
            disabled={activeWidget === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {WIDGET_SECTIONS[activeWidget]?.title}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToWidget(Math.min(widgets.length - 1, activeWidget + 1))}
            disabled={activeWidget === widgets.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Dialogs */}
        <AddTaskDialog
          familyMembers={familyMembers}
          familyId={profile.family_id}
          profileId={profile.id}
          onTaskCreated={onTaskUpdated}
          open={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
        preselectedMemberId={member.id}
        />
        
        <EventDialog
          open={isEventDialogOpen}
          onOpenChange={setIsEventDialogOpen}
          familyMembers={familyMembers}
          familyId={profile.family_id}
          defaultMember={member.id}
          onSave={async () => {
            onTaskUpdated();
            setIsEventDialogOpen(false);
          }}
        />
      </div>
    );
  }

  // Desktop Layout - Horizontal
  return (
    <div className="w-full max-w-7xl mx-auto">
      {renderMemberHeader()}
      
      <div className="grid grid-cols-4 gap-6 h-[calc(100vh-300px)]">
        {widgets.map((widget, index) => (
          <div key={index} className="min-h-0">
            {widget}
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <AddTaskDialog
        familyMembers={familyMembers}
        familyId={profile.family_id}
        profileId={profile.id}
        onTaskCreated={onTaskUpdated}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        preselectedMemberId={member.id}
      />
      
      <EventDialog
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        familyMembers={familyMembers}
        familyId={profile.family_id}
        defaultMember={member.id}
        onSave={async () => {
          onTaskUpdated();
          setIsEventDialogOpen(false);
        }}
      />
    </div>
  );
};