import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MemberTasksWidget } from '@/components/MemberTasksWidget';
import { MemberEventsWidget } from '@/components/MemberEventsWidget';
import { MemberPersonalListsEnhanced } from '@/components/MemberPersonalListsEnhanced';
import { MemberRewardsStack } from '@/components/MemberRewardsStack';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EventDialog } from '@/components/EventDialog';
import { getMemberColorClasses } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEvents } from '@/hooks/useEvents';
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
  { id: 'schedule', title: 'Today\'s Events', icon: Calendar },
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
  const [editingEvent, setEditingEvent] = useState(null);
  const isMobile = useIsMobile();

  const memberColors = getMemberColorClasses(member.color);
  const { createEvent, updateEvent, deleteEvent, refreshEvents } = useEvents(profile.family_id);
  
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
    </div>
  );

  const renderTasksWidget = () => (
    <MemberTasksWidget
      member={member}
      tasks={tasks}
      familyMembers={familyMembers}
      profile={profile}
      onTaskUpdated={onTaskUpdated}
      onEditTask={onEditTask}
      onTaskComplete={onTaskComplete}
      onAddTask={() => setIsTaskDialogOpen(true)}
    />
  );

  const renderScheduleWidget = () => (
    <MemberEventsWidget
      member={member}
      profile={profile}
      onAddEvent={() => {
        setEditingEvent(null);
        setIsEventDialogOpen(true);
      }}
      onEditEvent={(event) => {
        setEditingEvent(event);
        setIsEventDialogOpen(true);
      }}
    />
  );

  const renderListsWidget = () => (
    <MemberPersonalListsEnhanced
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
      <div className="w-full mx-auto px-4">
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
          onOpenChange={(open) => {
            setIsEventDialogOpen(open);
            if (!open) setEditingEvent(null);
          }}
          familyMembers={familyMembers}
          familyId={profile.family_id}
          defaultMember={member.id}
          editingEvent={editingEvent}
          onSave={async (eventData) => {
            try {
              if (editingEvent) {
                await updateEvent(editingEvent.id, eventData, eventData.attendees);
              } else {
                await createEvent(eventData);
              }
              await refreshEvents();
              setIsEventDialogOpen(false);
              setEditingEvent(null);
            } catch (error) {
              console.error('Failed to save event:', error);
            }
          }}
          onDelete={editingEvent ? async () => {
            try {
              await deleteEvent(editingEvent.id);
              await refreshEvents();
              setIsEventDialogOpen(false);
              setEditingEvent(null);
            } catch (error) {
              console.error('Failed to delete event:', error);
            }
          } : undefined}
        />
      </div>
    );
  }

  // Desktop Layout - Full Width
  return (
    <div className="w-full mx-auto px-4">
      {renderMemberHeader()}
      
      <div className="grid grid-cols-4 gap-6 h-[calc(100vh-250px)]">
        {widgets.map((widget, index) => (
          <div key={index} className="min-h-0 h-full">
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
        onOpenChange={(open) => {
          setIsEventDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        familyMembers={familyMembers}
        familyId={profile.family_id}
        defaultMember={member.id}
        editingEvent={editingEvent}
        onSave={async (eventData) => {
          try {
            if (editingEvent) {
              await updateEvent(editingEvent.id, eventData, eventData.attendees);
            } else {
              await createEvent(eventData);
            }
            await refreshEvents();
            setIsEventDialogOpen(false);
            setEditingEvent(null);
          } catch (error) {
            console.error('Failed to save event:', error);
          }
        }}
        onDelete={editingEvent ? async () => {
          try {
            await deleteEvent(editingEvent.id);
            await refreshEvents();
            setIsEventDialogOpen(false);
            setEditingEvent(null);
          } catch (error) {
            console.error('Failed to delete event:', error);
          }
        } : undefined}
      />
    </div>
  );
};