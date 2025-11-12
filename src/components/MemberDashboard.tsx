import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MemberTasksWidget } from '@/components/MemberTasksWidget';
import { MemberEventsWidget } from '@/components/MemberEventsWidget';
import { MemberPersonalListsEnhanced } from '@/components/MemberPersonalListsEnhanced';
import { MemberRewardsGallery } from '@/components/rewards/MemberRewardsGallery';
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
  activeMemberId: string | null;
  dashboardMode: boolean;
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
  activeMemberId,
  dashboardMode
}: MemberDashboardProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    align: 'start', 
    dragFree: false,
    containScroll: 'trimSnaps'
  });
  const [activeWidget, setActiveWidget] = useState(0);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const isMobile = useIsMobile();

  const memberColors = getMemberColorClasses(member.color);
  const { events = [], createEvent, updateEvent, deleteEvent, refreshEvents } = useEvents(profile.family_id);
  
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

  // Listen for carousel changes to update active widget
  React.useEffect(() => {
    if (emblaApi) {
      const onSelect = () => {
        setActiveWidget(emblaApi.selectedScrollSnap());
      };
      emblaApi.on('select', onSelect);
      return () => {
        emblaApi.off('select', onSelect);
      };
    }
  }, [emblaApi]);

  const renderMemberHeader = () => (
    <div className={cn(
      "text-center py-6 sm:py-8 rounded-lg border-2 mb-6",
      memberColors.border,
      memberColors.bg10
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
      
      {/* Mobile Widget Navigation Buttons */}
      {isMobile && (
        <div className="flex justify-center gap-2 mt-4">
          {WIDGET_SECTIONS.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeWidget === index ? "default" : "outline"}
                size="sm"
                onClick={() => scrollToWidget(index)}
                className={cn(
                  "h-12 w-12 p-0",
                  activeWidget === index && memberColors.accent
                )}
                aria-label={`Go to ${section.title}`}
              >
                <IconComponent className="h-5 w-5" />
              </Button>
            );
          })}
        </div>
      )}
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
      onAddTask={() => setIsTaskDialogOpen(true)}
      activeMemberId={activeMemberId}
      isDashboardMode={dashboardMode}
    />
  );

  const renderScheduleWidget = () => (
    <MemberEventsWidget
      member={member}
      profile={profile}
      events={events}
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
    <MemberRewardsGallery member={member} />
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
        
        {/* Mobile Carousel - Full Width */}
        <div className="overflow-hidden -mx-4" ref={emblaRef}>
          <div className="flex">
            {widgets.map((widget, index) => (
              <div key={index} className="flex-[0_0_100%] px-4">
                <div className="h-[calc(100vh-400px)] w-full">
                  {widget}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Navigation - Current Widget Title */}
        <div className="flex justify-center items-center mt-4">
          <span className="text-lg font-medium text-center">
            {WIDGET_SECTIONS[activeWidget]?.title}
          </span>
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
          currentProfileId={profile.id}
          onSave={async (eventData) => {
            try {
              if (editingEvent) {
                await updateEvent(editingEvent.id, eventData, eventData.attendees);
              } else {
                await createEvent(eventData, profile.id);
              }
              setIsEventDialogOpen(false);
              setEditingEvent(null);
            } catch (error) {
              console.error('Failed to save event:', error);
            }
          }}
          onDelete={editingEvent ? async () => {
            try {
              await deleteEvent(editingEvent.id);
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
        currentProfileId={profile.id}
        editingEvent={editingEvent}
          onSave={async (eventData) => {
            try {
              console.log('MemberDashboard saving event:', eventData.title, 'with profile.id:', profile.id);
              if (editingEvent) {
                await updateEvent(editingEvent.id, eventData, eventData.attendees);
              } else {
                await createEvent(eventData, profile.id);
              }
            setIsEventDialogOpen(false);
            setEditingEvent(null);
            // Trigger calendar refresh
            if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
              (window as any).refreshCalendar();
            }
          } catch (error) {
            console.error('Failed to save event:', error);
          }
        }}
        onDelete={editingEvent ? async () => {
          try {
            await deleteEvent(editingEvent.id);
            setIsEventDialogOpen(false);
            setEditingEvent(null);
            // Trigger calendar refresh
            if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
              (window as any).refreshCalendar();
            }
          } catch (error) {
            console.error('Failed to delete event:', error);
          }
        } : undefined}
      />
    </div>
  );
};