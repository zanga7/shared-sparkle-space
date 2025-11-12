import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getMemberColorClasses } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Edit, Trash2, Calendar, List, Users, Gift, Settings } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { AddButton } from '@/components/ui/add-button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';

import { CalendarView } from '@/components/CalendarView';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { MemberDashboard } from './MemberDashboard';
import { RewardsGallery } from '@/components/rewards/RewardsGallery';
import { ChildAuthProvider } from '@/hooks/useChildAuth';
import Lists from '@/pages/Lists';
import { TaskGroupsList } from '@/components/tasks/TaskGroupsList';
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
import { Task, Profile } from '@/types/task';
import { TaskGroup, VALID_TASK_GROUPS } from '@/types/taskGroup';
import { 
  getTaskGroupIcon, 
  getTaskGroupTitle, 
  shouldGroupBeOpenByDefault,
  getGroupDueDate,
  getTaskGroup,
  groupTasksByTime 
} from '@/utils/taskGroupUtils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { MemberPinDialog } from '@/components/dashboard/MemberPinDialog';
import { MemberSwitchDialog } from '@/components/dashboard/MemberSwitchDialog';
import { MemberSelectorDialog } from '@/components/dashboard/MemberSelectorDialog';
import { useDashboardMode } from '@/hooks/useDashboardMode';

const ColumnBasedDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMemberForTask, setSelectedMemberForTask] = useState<string | null>(null);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('columns');
  const [viewMode, setViewMode] = useState<'everyone' | 'member'>('everyone'); // Track if showing everyone or specific member
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<string | null>(null);
  
  // Dashboard mode state using hook
  const { dashboardModeEnabled } = useDashboardMode();
  const dashboardMode = dashboardModeEnabled;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'complete_task' | 'delete_list_item';
    taskId?: string;
    requiredMemberId?: string;
    onSuccess: () => void;
  } | null>(null);
  
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  
  const {
    activeMemberId: hookActiveMemberId,
    switchToMember,
    authenticateMemberPin,
    canPerformAction,
    isAuthenticating
  } = useDashboardAuth();

  // Update local state when hook value changes
  useEffect(() => {
    setActiveMemberId(hookActiveMemberId);
  }, [hookActiveMemberId]);

  // Handle member switching
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

  // Handle tab changes - clear member selection when switching to tab view
  const handleTabChange = (tab: string) => {
    // If Dashboard Mode is disabled, block tab navigation
    if (!dashboardMode) {
      return;
    }
    setActiveTab(tab);
    setSelectedMemberFilter(null); // Clear member selection
    setViewMode('everyone');
  };

  // Handle member selection for filtering
  const handleMemberSelect = (memberId: string | null) => {
    setSelectedMemberFilter(memberId);
    if (memberId === null) {
      // Only allow "everyone" view if Dashboard Mode is enabled
      if (dashboardMode) {
        setViewMode('everyone');
        setActiveTab('columns'); // Reset to default tab
      }
    } else {
      setViewMode('member');
      setActiveTab(''); // Clear active tab when viewing member dashboard
    }
  };

  // Force member view when Dashboard Mode is disabled
  useEffect(() => {
    if (!dashboardMode && profile && viewMode === 'everyone') {
      // Automatically switch to the authenticated user's member view
      setViewMode('member');
      setSelectedMemberFilter(profile.id);
      setActiveTab('');
    }
  }, [dashboardMode, profile, viewMode]);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (user && !profile && !hasFetchedRef.current && !isFetchingRef.current) {
      console.log('🔄 Initial data fetch triggered');
      hasFetchedRef.current = true;
      isFetchingRef.current = true;
      fetchUserData().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [user]); // Remove profile?.id dependency to prevent loops

  // Set up realtime subscription for task changes
  useEffect(() => {
    if (!profile?.family_id) return;

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${profile.family_id}`
        },
        async (payload) => {
          console.log('🔔 New task detected via realtime:', payload.new);
          
          // Fetch full task data with relations
          const { data: newTaskData } = await supabase
            .from('tasks')
            .select(`
              id,
              title,
              description,
              points,
              due_date,
              assigned_to,
              created_by,
              completion_rule,
              task_group,
              assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
              assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
              task_completions(id, completed_at, completed_by)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newTaskData) {
            setTasks(prevTasks => {
              // Check if task already exists
              if (prevTasks.some(t => t.id === newTaskData.id)) {
                return prevTasks;
              }
              return [...prevTasks, {
                ...newTaskData,
                completion_rule: (newTaskData.completion_rule || 'everyone') as 'any_one' | 'everyone'
              }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.family_id]);

  // Subscribe to task_assignees inserts to hydrate assignees after rotating task generation
  useEffect(() => {
    if (!profile?.family_id) return;

    const assigneesChannel = supabase
      .channel('task-assignees-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignees',
        },
        async (payload) => {
          try {
            // Fetch the full task with relations once an assignee is added
            const { data: taskData } = await supabase
              .from('tasks')
              .select(`
                id,
                title,
                description,
                points,
                due_date,
                assigned_to,
                created_by,
                completion_rule,
                task_group,
                family_id,
                assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
                assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
                task_completions(id, completed_at, completed_by)
              `)
              .eq('id', (payload as any).new.task_id)
              .single();

            if (!taskData || taskData.family_id !== profile.family_id) return;

            setTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === taskData.id);
              const normalized = {
                ...taskData,
                completion_rule: (taskData.completion_rule || 'everyone') as 'any_one' | 'everyone',
              };
              if (idx === -1) return [...prev, normalized];
              const copy = prev.slice();
              copy[idx] = { ...copy[idx], ...normalized };
              return copy;
            });
          } catch (e) {
            console.error('Failed to update task after assignee insert', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assigneesChannel);
    };
  }, [profile?.family_id]);


  const cleanupDuplicateRotatingTasksToday = async (familyId: string) => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Get active rotating task names for this family
      const { data: rotating, error: namesError } = await supabase
        .from('rotating_tasks')
        .select('name, allow_multiple_completions')
        .eq('family_id', familyId)
        .eq('is_active', true);

      if (namesError) {
        console.error('Failed to load rotating task names:', namesError);
        return;
      }

      const rotatingMap = new Map((rotating || []).map(r => [r.name, r.allow_multiple_completions]));
      const names = Array.from(rotatingMap.keys());
      if (names.length === 0) return;

      // Fetch today's tasks for those names with assignees
      const { data: todaysTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, created_at, due_date, task_assignees!inner(profile_id), task_completions(id)')
        .eq('family_id', familyId)
        .in('title', names)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      if (tasksError) {
        console.error('Failed to load today\'s tasks for cleanup:', tasksError);
        return;
      }

      type Row = { id: string; title: string; created_at: string; due_date: string | null; task_assignees: { profile_id: string }[]; task_completions?: { id: string }[] };
      const rows = (todaysTasks as unknown as Row[]) || [];
      const toDelete: string[] = [];

      // Group by title only for single-instance tasks
      const byTitle = new Map<string, Row[]>();
      const byTitleAndAssignee = new Map<string, Row[]>();

      for (const row of rows) {
        const allowMultiple = rotatingMap.get(row.title);
        
        if (allowMultiple === false) {
          // Single instance per day: group by title only
          if (!byTitle.has(row.title)) byTitle.set(row.title, []);
          byTitle.get(row.title)!.push(row);
        } else {
          // Multiple completions: group by title + assignee
          const assigneeId = row.task_assignees?.[0]?.profile_id || 'unassigned';
          const key = `${row.title}::${assigneeId}`;
          if (!byTitleAndAssignee.has(key)) byTitleAndAssignee.set(key, []);
          byTitleAndAssignee.get(key)!.push(row);
        }
      }

      // Handle single-instance tasks: keep only ONE per title
      for (const [title, list] of byTitle) {
        if (list.length <= 1) continue;

        const isIncomplete = (r: Row) => !r.task_completions || r.task_completions.length === 0;
        const incomplete = list.filter(isIncomplete);

        let keep: Row;
        if (incomplete.length > 0) {
          // Keep the oldest incomplete task
          keep = incomplete.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        } else {
          // All completed: keep the oldest
          keep = list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        }

        for (const r of list) {
          if (r.id !== keep.id) toDelete.push(r.id);
        }
      }

      // Handle multiple-completion tasks: keep only ONE per (title, assignee)
      for (const [key, list] of byTitleAndAssignee) {
        if (list.length <= 1) continue;

        const isIncomplete = (r: Row) => !r.task_completions || r.task_completions.length === 0;
        const incomplete = list.filter(isIncomplete);

        let keep: Row;
        if (incomplete.length > 0) {
          keep = incomplete.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        } else {
          keep = list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        }

        for (const r of list) {
          if (r.id !== keep.id) toDelete.push(r.id);
        }
      }

      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('tasks')
          .delete()
          .in('id', toDelete);
        if (delError) {
          console.error('Failed deleting duplicates:', delError);
        } else {
          console.log(`🧹 Removed ${toDelete.length} duplicate rotating tasks`);
        }
      }
    } catch (e) {
      console.error('Error during duplicate cleanup:', e);
    }
  };

  const fetchUserData = async () => {
    try {
      console.log('🔄 fetchUserData called for user:', user?.id, 'email:', user?.email);
      console.log('🔄 Current profile state:', profile?.id, profile?.display_name);
      
      // Fetch current user profile with explicit user_id matching
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        console.log('Looking for existing profile with email:', user?.email);
        
        // Check if there's a profile that might be disconnected
        const { data: existingProfiles, error: searchError } = await supabase
          .from('profiles')
          .select('*, families(name)')
          .limit(10);
          
        if (!searchError && existingProfiles) {
          console.log('Found existing profiles:', existingProfiles);
        }
        
        // If profile not found, try to create it
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, attempting to create...');
          const { data: createResult, error: createError } = await supabase
            .rpc('fix_my_missing_profile');
          
          if (createError) {
            console.error('Failed to create profile:', createError);
            setProfileError('Failed to create profile. Please try signing out and back in.');
            return;
          }
          
          if (createResult && typeof createResult === 'object' && 'success' in createResult && createResult.success) {
            console.log('✅ Profile created successfully, retrying fetch...');
            // Retry fetching the profile instead of reloading
            const { data: retryProfileData, error: retryError } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', user?.id)
              .single();
            
            if (retryError) {
              console.error('Retry profile fetch failed:', retryError);
              setProfileError('Profile creation succeeded but fetch failed. Please refresh the page.');
              return;
            }
            
            setProfile(retryProfileData);
            
            // Fetch family members for this new profile
            const { data: membersData, error: membersError } = await supabase
              .from('profiles')
              .select('*')
              .eq('family_id', retryProfileData.family_id)
              .eq('status', 'active')
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true });

            if (membersError) {
              console.error('Members error:', membersError);
            } else {
              setFamilyMembers(membersData || []);
            }

            // Cleanup duplicate rotating tasks for today
            await cleanupDuplicateRotatingTasksToday(retryProfileData.family_id);

            // Fetch family tasks
            const { data: tasksData, error: tasksError } = await supabase
              .from('tasks')
              .select(`
                id,
                title,
                description,
                points,
                due_date,
                assigned_to,
                created_by,
                completion_rule,
                task_group,
                assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
                assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
                task_completions(id, completed_at, completed_by)
              `)
              .eq('family_id', retryProfileData.family_id);

            if (tasksError) {
              console.error('Tasks error:', tasksError);
            } else {
              // Type assertion to handle completion_rule from database
              const typedTasks = (tasksData || []).map(task => ({
                ...task,
                completion_rule: (task.completion_rule || 'everyone') as 'any_one' | 'everyone'
              }));
              setTasks(typedTasks);
            }
            
            setLoading(false);
            return;
          } else {
            setProfileError('Failed to create missing profile. Please contact support.');
            return;
          }
        } else {
          setProfileError('Failed to load profile. Please try refreshing the page.');
          return;
        }
      } else {
        setProfile(profileData);
      }

      setProfile(profileData);

      // Fetch family members ordered by sort_order for consistent column positioning
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (membersError) {
        console.error('Members error:', membersError);
      } else {
        setFamilyMembers(membersData || []);
      }

      // Generate rotating tasks for today before fetching
      try {
        console.log('🔄 Generating rotating tasks for family:', profileData.family_id);
        await supabase.functions.invoke('generate-rotating-tasks', {
          body: { family_id: profileData.family_id }
        });
      } catch (rotatingError) {
        console.error('Failed to generate rotating tasks:', rotatingError);
        // Continue anyway - don't block the dashboard
      }

      // Cleanup duplicate rotating tasks for today
      await cleanupDuplicateRotatingTasksToday(profileData.family_id);

      // Fetch family tasks with completion status
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          points,
          due_date,
          assigned_to,
          created_by,
          completion_rule,
          task_group,
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
          assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
          task_completions(id, completed_at, completed_by)
        `)
        .eq('family_id', profileData.family_id);

      if (tasksError) {
        console.error('Tasks error:', tasksError);
      } else {
        // Type assertion to handle completion_rule from database
        const typedTasks = (tasksData || []).map(task => ({
          ...task,
          completion_rule: (task.completion_rule || 'everyone') as 'any_one' | 'everyone'
        }));
        setTasks(typedTasks);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (task: Task) => {
    if (!profile) return;
    
    try {
      // Dashboard Mode: Check member identity and PIN requirements
      if (dashboardMode) {
        // Get all assignees for this task
        const assignees = task.assignees?.map(a => a.profile) || 
                         (task.assigned_profile ? [task.assigned_profile] : []);
        
        // Check if active member is one of the assignees (for team tasks)
        if (assignees.length > 0 && activeMemberId) {
          const isAssignedMember = assignees.some(assignee => assignee.id === activeMemberId);
          
          if (!isAssignedMember) {
            // Show switch dialog to select an assigned member
            setPendingAction({
              type: 'complete_task',
              taskId: task.id,
              requiredMemberId: assignees[0].id, // Default to first assignee for switch dialog
              onSuccess: () => executeTaskCompletion(task)
            });
            setSwitchDialogOpen(true);
            return;
          }
        }
        
        // Check PIN requirements for the active member
        const memberToCheck = activeMemberId;
        if (memberToCheck) {
          const { canProceed, needsPin, profile: memberProfile } = await canPerformAction(memberToCheck, 'task_completion');
          
          if (needsPin) {
            // Show PIN dialog
            setPendingAction({
              type: 'complete_task',
              taskId: task.id,
              requiredMemberId: memberToCheck,
              onSuccess: () => executeTaskCompletion(task)
            });
            setPinDialogOpen(true);
            return;
          }
          
          if (!canProceed) {
            toast({
              title: 'Cannot Complete Task',
              description: 'Permission denied for this action.',
              variant: 'destructive'
            });
            return;
          }
        }
      }
      
      // Regular mode or dashboard mode with permissions granted
      await executeTaskCompletion(task);
    } catch (error) {
      console.error('Error in completeTask:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }
  };

  const executeTaskCompletion = async (task: Task) => {
    if (!profile) return;
    
    try {

      // Regular task completion logic
      // Get all assignees for this task (including both old and new format)
      const assignees = task.assignees?.map(a => a.profile) || 
                       (task.assigned_profile ? [task.assigned_profile] : []);
      
      // In dashboard mode, use the active member as the completer if they're the assignee
      const completerId = dashboardMode && activeMemberId ? activeMemberId : profile.id;
      const completerProfile = familyMembers.find(m => m.id === completerId) || profile;
      
      // Check if completer is allowed to complete this task (only enforce when NOT in dashboard mode)
      if (!dashboardMode) {
        const isAssignee = assignees.some(assignee => assignee.id === completerId);
        if (assignees.length > 0 && !isAssignee) {
          toast({
            title: 'Cannot Complete Task',
            description: 'Only assigned members can complete this task.',
            variant: 'destructive'
          });
          return;
        }
      }
      
      // Determine point recipients based on completion rule
      let pointRecipients;
      if (task.completion_rule === 'any_one' && assignees.length > 1) {
        // "Any one" rule: only the completer gets points
        pointRecipients = [completerProfile];
      } else {
        // "Everyone" rule or single assignee: only the completer gets points
        pointRecipients = [completerProfile];
      }
      
      // Create task completion record
      const { error } = await supabase
        .from('task_completions')
        .insert({
          task_id: task.id,
           completed_by: profile.id, // Must use authenticated user's profile for RLS
          points_earned: task.points
        });

      if (error) {
        throw error;
      }

      // Award points to all assignees (or just the completer if no assignees)
      const pointUpdates = pointRecipients.map(async (recipient) => {
        const currentProfile = familyMembers.find(m => m.id === recipient.id);
        if (currentProfile) {
          return supabase
            .from('profiles')
            .update({
              total_points: currentProfile.total_points + task.points
            })
            .eq('id', recipient.id);
        }
      });

      const updateResults = await Promise.all(pointUpdates.filter(Boolean));
      
      // Check for errors in point updates
      const updateErrors = updateResults.filter(result => result?.error);
      if (updateErrors.length > 0) {
        throw new Error('Failed to update some points');
      }

      // Create toast message based on completion rule and point distribution
      let toastMessage;
      if (task.completion_rule === 'any_one' && assignees.length > 1) {
        const assigneeNames = assignees.map(a => a.display_name).join(', ');
        toastMessage = `Task completed for everyone! ${completerProfile.display_name} earned ${task.points} points. Assignees: ${assigneeNames}`;
      } else if (pointRecipients.length === 1 && pointRecipients[0].id === completerProfile.id) {
        toastMessage = dashboardMode && completerProfile.id !== profile.id 
          ? `${completerProfile.display_name} earned ${task.points} points!`
          : `You earned ${task.points} points!`;
      } else if (pointRecipients.length === 1) {
        toastMessage = `${pointRecipients[0].display_name} earned ${task.points} points!`;
      } else {
        const names = pointRecipients.map(p => p.display_name).join(', ');
        toastMessage = `${task.points} points awarded to: ${names}`;
      }

      toast({
        title: 'Task Completed!',
        description: toastMessage,
      });

      // Update local state instead of full refresh
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id 
            ? { ...t, task_completions: [...(t.task_completions || []), { 
                id: Date.now().toString(), 
                completed_at: new Date().toISOString(), 
                completed_by: profile.id 
              }] }
            : t
        )
      );
      
      // Update member points locally
      setFamilyMembers(prevMembers =>
        prevMembers.map(member => {
          const recipient = pointRecipients.find(r => r.id === member.id);
          return recipient 
            ? { ...member, total_points: member.total_points + task.points }
            : member;
        })
      );

      // Check if this is a rotating task and generate the next instance immediately
      try {
        // Try to look up by exact name first
        const { data: rotatingTask, error: rtErr } = await supabase
          .from('rotating_tasks')
          .select('id')
          .eq('name', task.title)
          .eq('family_id', profile.family_id)
          .eq('is_active', true)
          .eq('is_paused', false)
          .single();

        // Prefer targeting a specific rotating_task_id if we have it
        if (rotatingTask && !rtErr) {
          console.log('🔄 Generating next instance for rotating task by id:', task.title);
          await supabase.functions.invoke('generate-rotating-tasks', {
            body: { rotating_task_id: rotatingTask.id }
          });
        } else {
          // Fallback: trigger by task_name + family_id (case differences or minor mismatches)
          console.log('🔄 Generating next instance for rotating task by name:', task.title);
          await supabase.functions.invoke('generate-rotating-tasks', {
            body: { task_name: task.title, family_id: profile.family_id }
          });
        }

        // Refetch tasks immediately to show the new task
        await fetchUserData();
      } catch (rotatingError) {
        console.warn('⚠️ Rotating task generation did not run:', rotatingError);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }
  };

  const uncompleteTask = async (task: Task) => {
    if (!profile || !task.task_completions || task.task_completions.length === 0) return;
    
    try {
      // Find the completion record by the current user
      const userCompletion = task.task_completions.find(completion => completion.completed_by === profile.id);
      
      if (!userCompletion) {
        return;
      }

      // Get all assignees who received points based on completion rule
      let assignees;
      const allAssignees = task.assignees?.map(a => a.profile) || 
                          (task.assigned_profile ? [task.assigned_profile] : []);
      
      if (task.completion_rule === 'any_one' && allAssignees.length > 1) {
        // For "any_one" tasks, only the completer received points
        assignees = [profile];
      } else {
        // For "everyone" tasks or single assignee, only the completer received points
        assignees = [profile];
      }

      // Remove the specific task completion record
      const { error } = await supabase
        .from('task_completions')
        .delete()
        .eq('id', userCompletion.id);

      if (error) {
        throw error;
      }

      // Remove points from all assignees who received them
      const pointUpdates = assignees.map(async (recipient) => {
        const currentProfile = familyMembers.find(m => m.id === recipient.id);
        if (currentProfile) {
          return supabase
            .from('profiles')
            .update({
              total_points: currentProfile.total_points - task.points
            })
            .eq('id', recipient.id);
        }
      });

      const updateResults = await Promise.all(pointUpdates.filter(Boolean));
      
      // Check for errors in point updates
      const updateErrors = updateResults.filter(result => result?.error);
      if (updateErrors.length > 0) {
        throw new Error('Failed to update some points');
      }

      // Create toast message based on point removal
      let toastMessage;
      if (assignees.length === 1) {
        toastMessage = `${task.points} points removed`;
      } else {
        const names = assignees.map(p => p.display_name).join(', ');
        toastMessage = `${task.points} points removed from: ${names}`;
      }

      toast({
        title: 'Task Uncompleted',
        description: toastMessage,
      });

      // Update local state instead of full refresh
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id 
            ? { ...t, task_completions: [] }
            : t
        )
      );
      
      // Update member points locally (subtract points)
      setFamilyMembers(prevMembers =>
        prevMembers.map(member => {
          const wasRecipient = assignees.find(a => a.id === member.id);
          return wasRecipient 
            ? { ...member, total_points: Math.max(0, member.total_points - task.points) }
            : member;
        })
      );
    } catch (error) {
      console.error('Error uncompleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to uncomplete task',
        variant: 'destructive'
      });
    }
  };

  const handleTaskToggle = (task: Task) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    if (isCompleted) {
      uncompleteTask(task);
    } else {
      completeTask(task);
    }
  };

  const initiateTaskDeletion = async (task: Task) => {
    // Check if this is a rotating task
    const { data: rotatingTask } = await supabase
      .from('rotating_tasks')
      .select('id, name, allow_multiple_completions')
      .eq('name', task.title)
      .eq('family_id', profile?.family_id)
      .eq('is_active', true)
      .single();

    // If it's a rotating task and dashboard mode is enabled, require parent PIN
    if (rotatingTask && dashboardMode) {
      // Only parents can delete rotating tasks
      if (profile?.role !== 'parent') {
        toast({
          title: 'Permission Denied',
          description: 'Only parents can delete rotating tasks.',
          variant: 'destructive'
        });
        return;
      }

      // Require PIN confirmation
      setPendingAction({
        type: 'complete_task', // Reusing this type for deletion
        taskId: task.id,
        requiredMemberId: profile.id,
        onSuccess: () => {
          setDeletingTask(task);
          // Store rotating task info for later
          (task as any).isRotatingTask = true;
        }
      });
      setPinDialogOpen(true);
      return;
    }

    // Regular task deletion (no PIN needed)
    setDeletingTask(task);
  };

  const deleteTask = async () => {
    if (!deletingTask) return;

    const isRotatingTask = (deletingTask as any).isRotatingTask;

    try {
      // Check if this is a rotating task before deletion
      const { data: rotatingTask } = await supabase
        .from('rotating_tasks')
        .select('id, name, allow_multiple_completions, current_member_index, member_order')
        .eq('name', deletingTask.title)
        .eq('family_id', profile?.family_id)
        .eq('is_active', true)
        .single();

      // Delete the task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', deletingTask.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Task Deleted',
        description: 'Task has been removed successfully',
      });

      setDeletingTask(null);
      // Remove from local state instead of full refresh
      setTasks(prevTasks => prevTasks.filter(t => t.id !== deletingTask.id));

      // If this was a rotating task, generate the next instance
      if (rotatingTask) {
        console.log('🔄 Generating next instance for deleted rotating task');
        try {
          await supabase.functions.invoke('generate-rotating-tasks');
          toast({
            title: 'Next Task Generated',
            description: 'The task has been reassigned to the next person in rotation.',
          });
        } catch (genError) {
          console.error('Failed to generate next rotating task:', genError);
          toast({
            title: 'Warning',
            description: 'Task deleted but failed to generate next instance.',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    }
  };

  // Handle drag end for task assignment and group changes
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    console.log('Drag operation started:', {
      taskId: draggableId,
      source: source.droppableId,
      destination: destination?.droppableId,
    });

    // If dropped outside a droppable area
    if (!destination) {
      console.log('Drag cancelled - dropped outside droppable area');
      return;
    }

    // If dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      console.log('Drag cancelled - same position');
      return;
    }

    const taskId = draggableId;
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      console.error('Task not found for drag operation:', taskId);
      toast({
        title: 'Error',
        description: 'Task not found. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Store original state for rollback
    const previousTasks = [...tasks];
    
    // Parse droppable IDs to handle both member columns and group containers
    const parseDroppableId = (id: string): { memberId: string | null; group: string | null } => {
      if (id === 'unassigned') return { memberId: null, group: null };
      
      // Check if it's a member ID only (36 characters UUID)
      if (id.length === 36 && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return { memberId: id, group: null };
      }
      
      // Check if it's a member + group combination (UUID-<group>)
      const parts = id.split('-');
      
      // New format: UUID-group (6 parts total: 5 from UUID + 1 group)
      // Old format: UUID-pending-group or UUID-completed-group (7+ parts)
      if (parts.length >= 6) {
        const memberId = parts.slice(0, 5).join('-'); // Reconstruct UUID
        const remainder = parts.slice(5).join('-'); // e.g. "morning" or "pending-morning"
        
        if (memberId.length === 36 && memberId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // Remove pending-/completed- prefix if present (for backwards compatibility)
          const group = remainder.replace(/^pending-/, '').replace(/^completed-/, '');
          
          if (VALID_TASK_GROUPS.includes(group as TaskGroup)) {
            return { memberId, group };
          }
        }
      }
      
      // Check if it's just a group name (for member view)
      if (VALID_TASK_GROUPS.includes(id as TaskGroup)) {
        return { memberId: null, group: id };
      }
      
      console.error('Invalid droppable ID format:', id);
      return { memberId: null, group: null };
    };
    
    const sourceInfo = parseDroppableId(source.droppableId);
    const destInfo = parseDroppableId(destination.droppableId);

    // Validate parsed IDs before proceeding
    if (sourceInfo.memberId === null && sourceInfo.group === null && source.droppableId !== 'unassigned') {
      console.error('Failed to parse source droppable ID:', source.droppableId);
      toast({
        title: 'Error',
        description: 'Invalid drag operation. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    if (destInfo.memberId === null && destInfo.group === null && destination.droppableId !== 'unassigned') {
      console.error('Failed to parse destination droppable ID:', destination.droppableId);
      toast({
        title: 'Error',
        description: 'Invalid drop location. Please try again.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const updateData: any = {};
      let needsUpdate = false;
      
      // Handle member assignment change
      if (sourceInfo.memberId !== destInfo.memberId && destInfo.memberId !== null) {
        try {
          // First, remove existing task assignees
          const { error: deleteError } = await supabase
            .from('task_assignees')
            .delete()
            .eq('task_id', taskId);

          if (deleteError) {
            console.error('Error deleting task assignees:', deleteError);
            throw deleteError;
          }

          // Update the main task assignment for backward compatibility
          updateData.assigned_to = destInfo.memberId;
          needsUpdate = true;

          // If assigning to a specific member, create new task_assignee record
          if (destInfo.memberId) {
            const { error: insertError } = await supabase
              .from('task_assignees')
              .insert({
                task_id: taskId,
                profile_id: destInfo.memberId,
                assigned_by: profile?.id
              });

            if (insertError) {
              console.error('Error inserting task assignee:', insertError);
              throw insertError;
            }
          }
        } catch (assignError) {
          console.error('Failed to update task assignment:', assignError);
          throw new Error('Failed to update task assignment');
        }
      }
      
      // Handle task group change
      if (destInfo.group && destInfo.group !== sourceInfo.group) {
        updateData.task_group = destInfo.group;
        updateData.due_date = getGroupDueDate(destInfo.group as TaskGroup);
        needsUpdate = true;
      }
      
      if (needsUpdate) {

        // Optimistically update local state
        setTasks(prevTasks => prevTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              ...updateData,
              // Update assignees if member changed
              ...(destInfo.memberId !== sourceInfo.memberId && destInfo.memberId && {
                assigned_to: destInfo.memberId,
                assignees: [{
                  id: crypto.randomUUID(),
                  profile_id: destInfo.memberId,
                  assigned_at: new Date().toISOString(),
                  assigned_by: profile?.id || '',
                  profile: familyMembers.find(m => m.id === destInfo.memberId) || {
                    id: destInfo.memberId,
                    display_name: 'Unknown',
                    role: 'child' as const,
                    color: 'gray'
                  }
                }]
              })
            };
          }
          return t;
        }));

        // Update the task in database
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', taskId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }

        console.log('Task update successful');

        const assignedMember = familyMembers.find(m => m.id === destInfo.memberId);
        let toastMessage = '';
        
        if (sourceInfo.memberId !== destInfo.memberId && destInfo.memberId) {
          toastMessage = `Task assigned to ${assignedMember?.display_name || 'member'}`;
        } else if (destInfo.memberId === null && sourceInfo.memberId !== null) {
          toastMessage = 'Task moved to unassigned';
        }
        
        if (destInfo.group && destInfo.group !== sourceInfo.group) {
          const groupMessage = `moved to ${getTaskGroupTitle(destInfo.group as TaskGroup)}`;
          toastMessage = toastMessage ? `${toastMessage} and ${groupMessage}` : `Task ${groupMessage}`;
        }

        toast({
          title: 'Task updated',
          description: toastMessage,
        });
      }
    } catch (error) {
      console.error('Error in drag and drop operation:', error);
      // Immediately rollback to previous state
      setTasks(previousTasks);
      
      toast({
        title: 'Failed to move task',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Efficient task refresh without full page reload
  const refreshTasksOnly = async () => {
    if (!profile?.family_id) return;
    
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          points,
          due_date,
          assigned_to,
          created_by,
          completion_rule,
          task_group,
          category_id,
          family_id,
          created_at,
          updated_at,
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
          assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
          task_completions(id, completed_at, completed_by)
        `)
        .eq('family_id', profile.family_id);

      if (!tasksError && tasksData) {
        const typedTasks = tasksData.map(task => ({
          ...task,
          completion_rule: (task.completion_rule || 'everyone') as 'any_one' | 'everyone'
        }));
        setTasks(typedTasks);
        console.log('Tasks refreshed successfully');
      } else if (tasksError) {
        console.error('Error refreshing tasks:', tasksError);
      }
    } catch (error) {
      console.error('Error in refreshTasksOnly:', error);
    }
  };


  // Get tasks organized by family member with filtering
  const getTasksByMember = () => {
    const tasksByMember = new Map<string, Task[]>();
    
    // Initialize with all family members in the same order as familyMembers array
    familyMembers.forEach(member => {
      tasksByMember.set(member.id, []);
    });
    
    // Add unassigned tasks category
    tasksByMember.set('unassigned', []);
    
    // Add regular tasks
    tasks.forEach(task => {
      if (task.assignees && task.assignees.length > 0) {
        // Task has multiple assignees - add to each
        task.assignees.forEach(assignee => {
          const memberTasks = tasksByMember.get(assignee.profile_id) || [];
          memberTasks.push(task);
          tasksByMember.set(assignee.profile_id, memberTasks);
        });
      } else if (task.assigned_to) {
        // Single assignee (old format)
        const memberTasks = tasksByMember.get(task.assigned_to) || [];
        memberTasks.push(task);
        tasksByMember.set(task.assigned_to, memberTasks);
      } else {
        // Unassigned task
        const unassignedTasks = tasksByMember.get('unassigned') || [];
        unassignedTasks.push(task);
        tasksByMember.set('unassigned', unassignedTasks);
      }
    });

    // Rotating tasks have been removed
    
    // Filter tasks by selected member if one is chosen
    if (selectedMemberFilter) {
      const filteredMap = new Map<string, Task[]>();
      filteredMap.set(selectedMemberFilter, tasksByMember.get(selectedMemberFilter) || []);
      return filteredMap;
    }
    
    return tasksByMember;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAddTaskForMember = (memberId: string, group?: TaskGroup) => {
    console.log('🎯 handleAddTaskForMember called with:', { memberId, group });
    setSelectedMemberForTask(memberId);
    setSelectedTaskGroup(group || null);
    setIsAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setSelectedMemberForTask(null);
    setSelectedTaskGroup(null);
  };

  const handleSettingsClick = () => {
    // Navigate to admin dashboard
    navigate('/admin');
  };

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
          console.error('Error fixing profile:', error);
          toast({
            title: "Error",
            description: "Failed to create profile. Please try signing out and back in.",
            variant: "destructive",
          });
          return;
        }

        if (data && typeof data === 'object' && 'success' in data && data.success) {
          toast({
            title: "Success",
            description: "Profile created successfully! Refreshing...",
          });
          // Refresh the page to reload with new profile
          window.location.reload();
        } else {
          const errorMessage = data && typeof data === 'object' && 'error' in data 
            ? String(data.error) 
            : "Failed to create profile";
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Profile fix error:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    };

    const handleForceSignOut = async () => {
      try {
        // Clear local storage first
        localStorage.clear();
        sessionStorage.clear();
        
        // Try to sign out from Supabase
        await supabase.auth.signOut({ scope: 'local' });
        
        // Force reload to clear any cached state
        window.location.href = '/auth';
      } catch (error) {
        console.error('Sign out error:', error);
        // Even if signOut fails, clear local state and redirect
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
                <Button onClick={handleFixProfile} className="w-full">
                  Create Missing Profile
                </Button>
                
                <Button onClick={handleForceSignOut} variant="outline" className="w-full">
                  Sign Out & Try Again
                </Button>
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

  const tasksByMember = getTasksByMember();

  return (
    <div className="min-h-screen bg-background w-full">
      {/* Navigation Header */}
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

      {/* Main Content */}
      <div className="w-full px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
        {viewMode === 'member' && selectedMemberFilter ? (
          /* Member-specific single dashboard page */
          (() => {
            const member = familyMembers.find(m => m.id === selectedMemberFilter);
            if (!member) return null;
            
            return (
              <MemberDashboard
                member={member}
                tasks={tasks}
                familyMembers={familyMembers}
                profile={profile}
                onTaskUpdated={fetchUserData}
                onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                onTaskComplete={(task) => completeTask(task)}
                activeMemberId={activeMemberId}
                dashboardMode="member"
              />
            );
          })()
        ) : (
          /* Everyone view - show tabs */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Hidden tab list since navigation is in header */}
            <TabsList className="hidden">
              <TabsTrigger value="columns">Tasks</TabsTrigger>
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>

          <TabsContent value="columns" className="mt-4 sm:mt-6">
            {viewMode === 'everyone' ? (
              <DragDropContext onDragEnd={handleDragEnd} onDragStart={() => console.log('Drag started')}>
                <div className="w-full overflow-x-auto touch-pan-x">
                  <div className="flex gap-3 sm:gap-4 pb-4" style={{ minWidth: 'fit-content' }}>
                     {/* Family member columns - show all members in everyone mode */}
                     {familyMembers.map(member => {
                     const memberTasks = tasksByMember.get(member.id) || [];
                     const completedTasks = memberTasks.filter(task => 
                       task.task_completions && task.task_completions.length > 0
                     );
                     const pendingTasks = memberTasks.filter(task => 
                       !task.task_completions || task.task_completions.length === 0
                     );

                     return (
                        <Card key={member.id} className={cn(
                          "flex-shrink-0 w-72 sm:w-80 h-fit border-2 group",
                          getMemberColorClasses(member.color).border,
                          getMemberColorClasses(member.color).bgSoft
                        )}>
                            <CardHeader className={cn(
                             "pb-3 border-b",
                             getMemberColorClasses(member.color).border
                           )}>
                            <div className="flex items-center gap-3">
                               <UserAvatar
                                 name={member.display_name}
                                 color={member.color}
                                 size="md"
                                 className="sm:h-10 sm:w-10"
                               />
                               <div className="min-w-0 flex-1">
                                 <CardTitle className="text-base sm:text-lg truncate">{member.display_name}</CardTitle>
                                 <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                   <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-xs">
                                     {member.role}
                                   </Badge>
                                   <span className="truncate">{member.total_points} pts</span>
                                 </div>
                              </div>
                             </div>
                              <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                                <span>{pendingTasks.length} pending</span>
                                <span>{completedTasks.length} completed</span>
                              </div>
                            </CardHeader>

                             <CardContent className="p-0">
                                <TaskGroupsList
                                  tasks={memberTasks}
                                  allTasks={tasks}
                                  familyMembers={familyMembers}
                                  onTaskToggle={handleTaskToggle}
                                 onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                                 onDeleteTask={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                 onAddTask={(group) => handleAddTaskForMember(member.id, group)}
                                 onDragEnd={handleDragEnd}
                                 showActions={profile.role === 'parent'}
                                 memberId={member.id}
                                 memberColor={member.color}
                                 droppableIdPrefix={`${member.id}-`}
                               />
                             </CardContent>
                             
                             {/* Add Task Button at Member Level */}
                             {profile.role === 'parent' && (
                               <div className="px-4 pb-4">
                                 <AddButton
                                   className={cn(
                                     "w-full text-xs opacity-0 group-hover:opacity-75 transition-opacity",
                                     getMemberColorClasses(member.color).border,
                                     getMemberColorClasses(member.color).text
                                   )}
                                   text="Add Task"
                                   showIcon={true}
                                   onClick={() => handleAddTaskForMember(member.id)}
                                 />
                               </div>
                             )}
                         </Card>
                     );
                   })}

                   {/* Unassigned tasks column - only show if no member filter or if unassigned has tasks */}
                   {!selectedMemberFilter && (tasksByMember.get('unassigned')?.length > 0 || profile.role === 'parent') && (
                     <Card className="flex-shrink-0 w-72 sm:w-80 h-fit">
                      <CardHeader className="pb-3">
                         <div className="flex items-center gap-2 sm:gap-3">
                           <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                             <AvatarFallback className="bg-muted text-muted-foreground text-xs sm:text-sm">
                               ?
                             </AvatarFallback>
                           </Avatar>
                           <div className="min-w-0 flex-1">
                             <CardTitle className="text-base sm:text-lg">Unassigned</CardTitle>
                             <CardDescription className="text-xs sm:text-sm">Drag to assign to members</CardDescription>
                           </div>
                         </div>
                      </CardHeader>
                       <div className="group">
                       <Droppable droppableId="unassigned">
                         {(provided, snapshot) => (
                           <CardContent 
                             className={cn(
                               "space-y-3 transition-colors",
                               snapshot.isDraggingOver && "bg-accent/50"
                             )}
                             ref={provided.innerRef}
                             {...provided.droppableProps}
                           >
                             <div className="space-y-2 sm:space-y-3 mb-4 min-h-[100px]">
                               {tasksByMember.get('unassigned')?.length === 0 ? (
                                 <div className="text-center py-6 sm:py-8 text-muted-foreground">
                                   <Users className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                                   <p className="text-xs sm:text-sm px-2">
                                     {snapshot.isDraggingOver ? 'Drop here to unassign' : 'No unassigned tasks'}
                                   </p>
                                 </div>
                              ) : (
                                tasksByMember.get('unassigned')?.map((task, index) => (
                                  <Draggable key={task.id} draggableId={task.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={cn(
                                          snapshot.isDragging && "shadow-lg rotate-1 scale-105 z-50"
                                        )}
                                      >
                                        <EnhancedTaskItem
                                          task={task}
                                          allTasks={tasks}
                                          familyMembers={familyMembers}
                                          onToggle={handleTaskToggle}
                                          onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                          onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                          showActions={profile.role === 'parent' && !snapshot.isDragging}
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                )) || []
                               )}
                               {provided.placeholder}
                               
                               {/* Add Task Button for Unassigned */}
                               {profile.role === 'parent' && (
                                 <div className="pt-2 mt-4 border-t border-muted/50">
                                   <AddButton
                                     className="w-full text-xs opacity-0 group-hover:opacity-75 transition-opacity border-muted text-muted-foreground"
                                     text="Add Unassigned Task"
                                     showIcon={true}
                                     onClick={() => handleAddTaskForMember('unassigned')}
                                   />
                                 </div>
                               )}
                             </div>
                            
                             {/* Add Task Button */}
                             {profile.role === 'parent' && (
                               <div className="pt-3 border-t">
                                 <AddButton
                                   className="w-full"
                                   text="Add Task"
                                   onClick={() => setIsAddDialogOpen(true)}
                                 />
                               </div>
                             )}
                           </CardContent>
                         )}
                       </Droppable>
                       </div>
                    </Card>
                  )}
                  </div>
                </div>
              </DragDropContext>
            ) : (
              /* Member-specific dashboard view */
              <div className="w-full">
                <div className="max-w-4xl mx-auto space-y-6">
                  {selectedMemberFilter && (() => {
                    const member = familyMembers.find(m => m.id === selectedMemberFilter);
                    if (!member) return null;
                    
                    const memberTasks = tasksByMember.get(member.id) || [];
                    const completedTasks = memberTasks.filter(task => 
                      task.task_completions && task.task_completions.length > 0
                    );
                    const pendingTasks = memberTasks.filter(task => 
                      !task.task_completions || task.task_completions.length === 0
                    );
                    
                    return (
                      <>
                        {/* Member Header */}
                        <div className="text-center py-6">
                          <UserAvatar 
                            name={member.display_name} 
                            color={member.color} 
                            size="lg" 
                            className="mx-auto mb-4" 
                          />
                          <h1 className="text-3xl font-bold text-foreground">{member.display_name}'s Dashboard</h1>
                          <div className="flex justify-center items-center gap-4 mt-2">
                            <Badge variant="outline" className="text-lg px-4 py-2">
                              {member.total_points} points
                            </Badge>
                            <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                              {member.role}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Member Tasks */}
                        <Card className="p-6">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <Users className="h-5 w-5" />
                              Tasks ({pendingTasks.length} pending, {completedTasks.length} completed)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
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
                                    onToggle={handleTaskToggle}
                                    onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                    onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                    showActions={profile.role === 'parent'}
                                  />
                                ))}
                                {completedTasks.map((task) => (
                                  <EnhancedTaskItem
                                    key={task.id}
                                    task={task}
                                    allTasks={tasks}
                                    familyMembers={familyMembers}
                                    onToggle={handleTaskToggle}
                                    onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                    onDelete={profile.role === 'parent' ? initiateTaskDeletion : undefined}
                                    showActions={profile.role === 'parent'}
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
                          <UserAvatar 
                            name={member.display_name} 
                            color={member.color} 
                            size="lg" 
                            className="mx-auto mb-4" 
                          />
                          <h1 className="text-3xl font-bold text-foreground">{member.display_name}'s Lists</h1>
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

          <TabsContent value="calendar" className="mt-4 sm:mt-6">
            <div className="w-full">
              {viewMode === 'member' && selectedMemberFilter ? (
                <div className="max-w-6xl mx-auto">
                  <div className="text-center py-6 mb-6">
                    {(() => {
                      const member = familyMembers.find(m => m.id === selectedMemberFilter);
                      return member ? (
                        <>
                          <UserAvatar 
                            name={member.display_name} 
                            color={member.color} 
                            size="lg" 
                            className="mx-auto mb-4" 
                          />
                          <h1 className="text-3xl font-bold text-foreground">{member.display_name}'s Calendar</h1>
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
                            <UserAvatar 
                              name={member.display_name} 
                              color={member.color} 
                              size="lg" 
                              className="mx-auto mb-4" 
                            />
                            <h1 className="text-3xl font-bold text-foreground">{member.display_name}'s Rewards</h1>
                            <Badge variant="outline" className="text-lg px-4 py-2 mt-2">
                              {member.total_points} points available
                            </Badge>
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

      {/* Dashboard PIN Authentication Dialog */}
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

      {/* Dashboard Member Switch Dialog */}
      {switchDialogOpen && pendingAction && (
        <MemberSwitchDialog
          open={switchDialogOpen}
          onOpenChange={setSwitchDialogOpen}
          members={familyMembers}
          currentMemberId={activeMemberId}
          requiredMemberId={pendingAction.requiredMemberId || ''}
          onSwitch={(memberId, member) => {
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

      {/* Dashboard Member Selector Dialog */}
      {showMemberSelector && (
        <MemberSelectorDialog
          open={showMemberSelector}
          onOpenChange={setShowMemberSelector}
          members={familyMembers}
          currentMemberId={activeMemberId}
          onSelect={(memberId, member) => {
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