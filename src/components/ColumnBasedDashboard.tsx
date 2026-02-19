import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MemberTaskColumn } from '@/components/dashboard/MemberTaskColumn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { PageHeading } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { CalendarView } from '@/components/CalendarView';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { MemberDashboard } from './MemberDashboard';
import { FamilyDashboard } from './FamilyDashboard';
import { RewardsGallery } from '@/components/rewards/RewardsGallery';
import { ChildAuthProvider } from '@/hooks/useChildAuth';
import Lists from '@/pages/Lists';
import { GoalsContent } from '@/components/goals/GoalsContent';
import { GoalsProvider } from '@/hooks/useGoals';
import { TaskGroup } from '@/types/taskGroup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Task } from '@/types/task';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useDashboardMode } from '@/hooks/useDashboardMode';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { MemberPinDialog } from '@/components/dashboard/MemberPinDialog';
import { MemberSwitchDialog } from '@/components/dashboard/MemberSwitchDialog';
import { MemberSelectorDialog } from '@/components/dashboard/MemberSelectorDialog';

// Sub-hooks
import { useDashboardTaskData } from '@/hooks/useDashboardTaskData';
import { useDashboardNavigation } from '@/hooks/useDashboardNavigation';
import { useDashboardDragDrop } from '@/hooks/useDashboardDragDrop';
import { useDashboardTaskActions } from '@/hooks/useDashboardTaskActions';

const ColumnBasedDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Dashboard mode
  const { dashboardModeEnabled } = useDashboardMode();
  const dashboardMode = dashboardModeEnabled;

  // Dashboard auth (member switching)
  const {
    activeMemberId: hookActiveMemberId,
    switchToMember,
  } = useDashboardAuth();

  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  useEffect(() => {
    setActiveMemberId(hookActiveMemberId);
  }, [hookActiveMemberId]);

  // --- Sub-hooks ---
  const {
    profile, setProfile,
    familyMembers, setFamilyMembers,
    tasks, setTasks,
    allTasks,
    loading, profileError,
    fetchUserData, refreshTasksOnly, fetchTaskSeries,
    isTaskCompletedForMember, getTasksByMember,
  } = useDashboardTaskData({ user });

  const {
    activeTab, setActiveTab,
    viewMode, setViewMode,
    selectedMemberFilter,
    handleTabChange, handleMemberSelect, handleSettingsClick,
  } = useDashboardNavigation();

  const { handleDragEnd } = useDashboardDragDrop({
    tasks, setTasks, allTasks, profile, familyMembers,
  });

  const {
    editingTask, setEditingTask,
    deletingTask, setDeletingTask,
    pinDialogOpen, setPinDialogOpen,
    switchDialogOpen, setSwitchDialogOpen,
    pendingAction, setPendingAction,
    isCompleting,
    authenticateMemberPin, isAuthenticating,
    handleTaskToggle, initiateTaskDeletion, deleteTask,
    completeTask,
  } = useDashboardTaskActions({
    profile, familyMembers, activeMemberId, dashboardMode,
    setTasks, setProfile, setFamilyMembers,
    refreshTasksOnly, fetchTaskSeries,
  });

  // --- Local UI state ---
  const [selectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMemberForTask, setSelectedMemberForTask] = useState<string | null>(null);
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<string | null>(null);

  const handleMemberSwitch = (memberId: string | null) => {
    if (memberId === null) {
      setShowMemberSelector(true);
    } else {
      const member = familyMembers.find(m => m.id === memberId);
      if (member) {
        switchToMember(memberId);
        setActiveMemberId(memberId);
      }
    }
  };

  const handleAddTaskForMember = (memberId: string, group?: TaskGroup) => {
    setSelectedMemberForTask(memberId);
    setSelectedTaskGroup(group || null);
    setIsAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setSelectedMemberForTask(null);
    setSelectedTaskGroup(null);
  };

  // --- Loading / Error states ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg">Loading your family dashboard...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    const handleFixProfile = async () => {
      try {
        const { data, error } = await supabase.rpc('fix_my_missing_profile');
        if (error) {
          toast({ title: "Error", description: "Failed to create profile. Please try signing out and back in.", variant: "destructive" });
          return;
        }
        if (data && typeof data === 'object' && 'success' in data && data.success) {
          toast({ title: "Success", description: "Profile created successfully! Refreshing..." });
          window.location.reload();
        } else {
          const errorMessage = data && typeof data === 'object' && 'error' in data ? String(data.error) : "Failed to create profile";
          toast({ title: "Error", description: errorMessage, variant: "destructive" });
        }
      } catch {
        toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
      }
    };

    const handleForceSignOut = async () => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        await supabase.auth.signOut({ scope: 'local' });
        window.location.href = '/auth';
      } catch {
        window.location.href = '/auth';
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-lg font-semibold">Profile Not Found</div>
              <p className="text-muted-foreground">
                Your account exists but your profile is missing. This can happen if there was an issue during account creation.
              </p>
              <div className="space-y-3">
                <Button onClick={handleFixProfile} className="w-full">Create Missing Profile</Button>
                <Button onClick={handleForceSignOut} variant="outline" className="w-full">Sign Out & Try Again</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If the problem persists, try signing out and creating a new account.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tasksByMember = getTasksByMember(selectedMemberFilter);

  return (
    <div className="min-h-screen bg-background w-full">
      <NavigationHeader
        familyMembers={familyMembers}
        selectedMember={selectedMemberFilter}
        onMemberSelect={handleMemberSelect}
        onSettingsClick={handleSettingsClick}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activeMemberId={activeMemberId}
        onMemberSwitch={handleMemberSwitch}
        dashboardMode={dashboardMode}
        viewMode={viewMode}
      />

      <div className="w-full page-padding">
        {viewMode === 'member' && selectedMemberFilter ? (
          (() => {
            const member = familyMembers.find(m => m.id === selectedMemberFilter);
            if (!member) return null;
            return (
              <MemberDashboard
                member={member}
                tasks={allTasks}
                familyMembers={familyMembers}
                profile={profile}
                onTaskUpdated={fetchUserData}
                onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                activeMemberId={activeMemberId}
                dashboardMode={dashboardMode}
                setTasks={setTasks}
                setProfile={setProfile}
                setFamilyMembers={setFamilyMembers}
              />
            );
          })()
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="hidden">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="columns">Tasks</TabsTrigger>
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-0">
              <GoalsProvider>
                <FamilyDashboard
                  familyMembers={familyMembers}
                  tasks={allTasks}
                  familyId={profile.family_id}
                  onNavigateToTasks={() => setActiveTab('columns')}
                  onNavigateToCalendar={() => setActiveTab('calendar')}
                  onNavigateToGoals={() => setActiveTab('goals')}
                  onMemberSelect={(memberId) => {
                    handleMemberSelect(memberId);
                  }}
                />
              </GoalsProvider>
            </TabsContent>

            <TabsContent value="columns" className="mt-4 sm:mt-6">
              <div className="section-spacing">
                <PageHeading>Tasks</PageHeading>
              </div>
              {viewMode === 'everyone' ? (
                <DragDropContext onDragEnd={handleDragEnd} onDragStart={() => {}}>
                  {/* Mobile: Single column carousel */}
                  <div className="block md:hidden w-full">
                    <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                      <div className="flex gap-4 pb-4">
                        {familyMembers.map(member => {
                          const memberTasks = tasksByMember.get(member.id) || [];
                          const completedTasks = memberTasks.filter(task => isTaskCompletedForMember(task, member.id));
                          return (
                            <div key={member.id} className="snap-center shrink-0 w-[calc(100vw-2rem)]">
                              <MemberTaskColumn
                                member={member}
                                memberTasks={memberTasks}
                                completedTasks={completedTasks}
                                allTasks={tasks}
                                familyMembers={familyMembers}
                                onTaskToggle={handleTaskToggle}
                                onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                                onDeleteTask={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                onAddTask={handleAddTaskForMember}
                                onAddTaskForMember={handleAddTaskForMember}
                                onDragEnd={handleDragEnd}
                                showActions={profile.role === 'parent'}
                                isCompleting={isCompleting}
                              />
                            </div>
                          );
                        })}
                        {!selectedMemberFilter && ((tasksByMember.get('unassigned')?.length ?? 0) > 0 || profile.role === 'parent') && (
                          <div className="snap-center shrink-0 w-[calc(100vw-2rem)]">
                            <Card className="h-fit">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base text-muted-foreground">Unassigned</CardTitle>
                                <CardDescription className="text-xs">Drag to assign to members</CardDescription>
                              </CardHeader>
                              <Droppable droppableId="unassigned">
                                {(provided, snapshot) => (
                                  <CardContent
                                    className={cn("component-spacing transition-colors", snapshot.isDraggingOver && "bg-accent/50")}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                  >
                                    <div className="space-y-2 mb-4 min-h-[100px]">
                                      {tasksByMember.get('unassigned')?.map((task, index) => (
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                          {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                              className={cn(snapshot.isDragging && "shadow-lg rotate-1 scale-105 z-50")}
                                            >
                                              <EnhancedTaskItem
                                                task={task} allTasks={tasks} familyMembers={familyMembers}
                                                onToggle={handleTaskToggle}
                                                onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                                onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                                showActions={profile.role === 'parent' && !snapshot.isDragging}
                                                isCompleting={isCompleting(task.id)}
                                                currentMemberId={activeMemberId || profile?.id}
                                                isUnassigned={true}
                                              />
                                            </div>
                                          )}
                                        </Draggable>
                                      )) || []}
                                      {provided.placeholder}
                                    </div>
                                  </CardContent>
                                )}
                              </Droppable>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop/Tablet */}
                  <div className="hidden md:block w-full">
                    <div className="md:overflow-x-auto xl:overflow-x-visible">
                      <div className="flex xl:grid xl:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4 pb-4 md:min-w-fit xl:min-w-0">
                        {familyMembers.map(member => {
                          const memberTasks = tasksByMember.get(member.id) || [];
                          const completedTasks = memberTasks.filter(task => isTaskCompletedForMember(task, member.id));
                          return (
                            <div key={member.id} className="md:shrink-0 md:w-64 md:min-w-[16rem] md:max-w-[20rem] xl:shrink xl:w-auto xl:min-w-0 xl:max-w-none">
                              <MemberTaskColumn
                                member={member}
                                memberTasks={memberTasks}
                                completedTasks={completedTasks}
                                allTasks={tasks}
                                familyMembers={familyMembers}
                                onTaskToggle={handleTaskToggle}
                                onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                                onDeleteTask={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                onAddTask={handleAddTaskForMember}
                                onAddTaskForMember={handleAddTaskForMember}
                                onDragEnd={handleDragEnd}
                                showActions={profile.role === 'parent'}
                                isCompleting={isCompleting}
                              />
                            </div>
                          );
                        })}
                        {!selectedMemberFilter && ((tasksByMember.get('unassigned')?.length ?? 0) > 0 || profile.role === 'parent') && (
                          <div className="md:shrink-0 md:w-64 md:min-w-[16rem] md:max-w-[20rem] xl:shrink xl:w-auto xl:min-w-0 xl:max-w-none">
                            <Card className="h-fit">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base text-muted-foreground">Unassigned</CardTitle>
                                <CardDescription className="text-xs">Drag to assign to members</CardDescription>
                              </CardHeader>
                              <Droppable droppableId="unassigned">
                                {(provided, snapshot) => (
                                  <CardContent
                                    className={cn("component-spacing transition-colors", snapshot.isDraggingOver && "bg-accent/50")}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                  >
                                    <div className="space-y-2 mb-4 min-h-[100px]">
                                      {tasksByMember.get('unassigned')?.map((task, index) => (
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                          {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                              className={cn(snapshot.isDragging && "shadow-lg rotate-1 scale-105 z-50")}
                                            >
                                              <EnhancedTaskItem
                                                task={task} allTasks={tasks} familyMembers={familyMembers}
                                                onToggle={handleTaskToggle}
                                                onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                                onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                                showActions={profile.role === 'parent' && !snapshot.isDragging}
                                                isCompleting={isCompleting(task.id)}
                                                currentMemberId={activeMemberId || profile?.id}
                                                isUnassigned={true}
                                              />
                                            </div>
                                          )}
                                        </Draggable>
                                      )) || []}
                                      {provided.placeholder}
                                    </div>
                                  </CardContent>
                                )}
                              </Droppable>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </DragDropContext>
              ) : (
                <div className="w-full">
                  <div className="max-w-4xl mx-auto space-y-6">
                    {selectedMemberFilter && (() => {
                      const member = familyMembers.find(m => m.id === selectedMemberFilter);
                      if (!member) return null;
                      const memberTasks = tasksByMember.get(member.id) || [];
                      const completedTasks = memberTasks.filter(task => isTaskCompletedForMember(task, member.id));
                      const pendingTasks = memberTasks.filter(task => !isTaskCompletedForMember(task, member.id));
                      return (
                        <>
                          <div className="text-center py-6">
                            <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="lg" className="mx-auto mb-4" />
                            <PageHeading>{member.display_name}'s Dashboard</PageHeading>
                            <div className="flex justify-center items-center gap-4 mt-2">
                              <Badge variant="outline" className="text-lg px-4 py-2">{member.total_points} points</Badge>
                              <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-lg px-4 py-2">{member.role}</Badge>
                            </div>
                          </div>
                          <Card className="p-6">
                            <CardHeader className="pb-4">
                              <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Tasks ({pendingTasks.length} pending, {completedTasks.length} completed)
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="component-spacing">
                              {pendingTasks.length === 0 && completedTasks.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                  <p>No tasks assigned</p>
                                </div>
                              ) : (
                                <>
                                  {pendingTasks.map((task) => (
                                    <EnhancedTaskItem key={task.id} task={task} allTasks={tasks} familyMembers={familyMembers}
                                      onToggle={handleTaskToggle}
                                      onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                      onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                      showActions={profile.role === 'parent'}
                                      isCompleting={isCompleting(task.id)}
                                      currentMemberId={activeMemberId || profile?.id}
                                    />
                                  ))}
                                  {completedTasks.map((task) => (
                                    <EnhancedTaskItem key={task.id} task={task} allTasks={tasks} familyMembers={familyMembers}
                                      onToggle={handleTaskToggle}
                                      onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                      onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                      showActions={profile.role === 'parent'}
                                      isCompleting={isCompleting(task.id)}
                                      currentMemberId={activeMemberId || profile?.id}
                                    />
                                  ))}
                                </>
                              )}
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="lists" className="mt-4 sm:mt-6">
              <div className="w-full">
                {viewMode === 'member' && selectedMemberFilter ? (
                  <div className="max-w-4xl mx-auto">
                    <div className="text-center py-6 mb-6">
                      {(() => {
                        const member = familyMembers.find(m => m.id === selectedMemberFilter);
                        return member ? (
                          <>
                            <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="lg" className="mx-auto mb-4" />
                            <PageHeading>{member.display_name}'s Lists</PageHeading>
                          </>
                        ) : null;
                      })()}
                    </div>
                    <Lists />
                  </div>
                ) : (
                  <Lists />
                )}
              </div>
            </TabsContent>

            <TabsContent value="goals" className="mt-4 sm:mt-6">
              <GoalsProvider>
                <div className="w-full">
                  {viewMode === 'member' && selectedMemberFilter ? (
                    <div className="max-w-4xl mx-auto">
                      <div className="text-center py-6 mb-6">
                        {(() => {
                          const member = familyMembers.find(m => m.id === selectedMemberFilter);
                          return member ? (
                            <>
                              <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="lg" className="mx-auto mb-4" />
                              <PageHeading>{member.display_name}'s Goals</PageHeading>
                            </>
                          ) : null;
                        })()}
                      </div>
                      <GoalsContent familyMembers={familyMembers} selectedMemberId={selectedMemberFilter} viewMode="member" />
                    </div>
                  ) : (
                    <GoalsContent familyMembers={familyMembers} />
                  )}
                </div>
              </GoalsProvider>
            </TabsContent>

            <TabsContent value="calendar" className="mt-4 sm:mt-6">
              <div className="w-full">
                {viewMode === 'member' && selectedMemberFilter ? (
                  <div className="max-w-6xl mx-auto">
                    <div className="text-center py-6 mb-6">
                      {(() => {
                        const member = familyMembers.find(m => m.id === selectedMemberFilter);
                        return member ? (
                          <>
                            <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="lg" className="mx-auto mb-4" />
                            <PageHeading>{member.display_name}'s Calendar</PageHeading>
                          </>
                        ) : null;
                      })()}
                    </div>
                    <CalendarView
                      tasks={tasks.filter(task =>
                        task.assigned_to === selectedMemberFilter ||
                        task.assignees?.some(a => a.profile_id === selectedMemberFilter)
                      )}
                      familyMembers={familyMembers.filter(m => m.id === selectedMemberFilter)}
                      profile={profile}
                      onTaskUpdated={fetchUserData}
                      onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                      familyId={profile.family_id}
                      dashboardMode={dashboardMode}
                      activeMemberId={activeMemberId}
                      onTaskComplete={completeTask}
                    />
                  </div>
                ) : (
                  <CalendarView
                    tasks={tasks}
                    familyMembers={familyMembers}
                    profile={profile}
                    onTaskUpdated={fetchUserData}
                    onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                    familyId={profile.family_id}
                    dashboardMode={dashboardMode}
                    activeMemberId={activeMemberId}
                    onTaskComplete={completeTask}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="rewards" className="mt-4 sm:mt-6">
              <div className="w-full">
                <ChildAuthProvider>
                  {viewMode === 'member' && selectedMemberFilter ? (
                    <div className="max-w-6xl mx-auto">
                      <div className="text-center py-6 mb-6">
                        {(() => {
                          const member = familyMembers.find(m => m.id === selectedMemberFilter);
                          return member ? (
                            <>
                              <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="lg" className="mx-auto mb-4" />
                              <PageHeading>{member.display_name}'s Rewards</PageHeading>
                              <Badge variant="outline" className="text-lg px-4 py-2 mt-2">{member.total_points} points available</Badge>
                            </>
                          ) : null;
                        })()}
                      </div>
                      <RewardsGallery selectedMemberId={selectedMemberFilter} />
                    </div>
                  ) : (
                    <RewardsGallery selectedMemberId={selectedMemberFilter} />
                  )}
                </ChildAuthProvider>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialogs */}
      {isAddDialogOpen && (
        <AddTaskDialog
          open={isAddDialogOpen}
          onOpenChange={handleDialogClose}
          familyMembers={familyMembers}
          familyId={profile.family_id}
          profileId={profile.id}
          onTaskCreated={fetchUserData}
          selectedDate={selectedDate}
          preselectedMemberId={selectedMemberForTask}
          preselectedTaskGroup={selectedTaskGroup}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
          familyMembers={familyMembers}
          familyId={profile.family_id}
          onTaskUpdated={fetchUserData}
        />
      )}

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pinDialogOpen && pendingAction && (
        <MemberPinDialog
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
          member={familyMembers.find(m => m.id === pendingAction.requiredMemberId) || familyMembers[0]}
          onSuccess={() => {
            if (pendingAction) {
              pendingAction.onSuccess();
              setPendingAction(null);
            }
            setPinDialogOpen(false);
          }}
          onAuthenticate={(pin) => authenticateMemberPin(pendingAction.requiredMemberId || '', pin)}
          isAuthenticating={isAuthenticating}
          action={pendingAction.type === 'complete_task' ? 'complete this task' : 'perform this action'}
        />
      )}

      {switchDialogOpen && pendingAction && (
        <MemberSwitchDialog
          open={switchDialogOpen}
          onOpenChange={setSwitchDialogOpen}
          members={familyMembers}
          currentMemberId={activeMemberId}
          requiredMemberId={pendingAction.requiredMemberId || ''}
          onSwitch={(memberId) => {
            switchToMember(memberId);
            if (pendingAction) {
              pendingAction.onSuccess();
              setPendingAction(null);
            }
            setSwitchDialogOpen(false);
          }}
          action={pendingAction.type === 'complete_task' ? 'complete this task' : 'perform this action'}
        />
      )}

      {showMemberSelector && (
        <MemberSelectorDialog
          open={showMemberSelector}
          onOpenChange={setShowMemberSelector}
          members={familyMembers}
          currentMemberId={activeMemberId}
          onSelect={(memberId) => {
            switchToMember(memberId);
            setActiveMemberId(memberId);
            setShowMemberSelector(false);
          }}
        />
      )}
    </div>
  );
};

export default ColumnBasedDashboard;
