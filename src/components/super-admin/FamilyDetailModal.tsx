import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ModuleToggleList } from './ModuleToggleList';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Archive, Trash2, Mail, Calendar, Clock, Smartphone, 
  AlertTriangle, User, Shield
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface FamilyDetailModalProps {
  familyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MemberWithEmail {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
  color: string;
  status: string;
  total_points: number;
  streak_count: number;
  user_id: string | null;
  created_at: string;
  email?: string;
}

export function FamilyDetailModal({ familyId, open, onOpenChange }: FamilyDetailModalProps) {
  const queryClient = useQueryClient();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ['family-detail', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('*, current_plan:subscription_plans(*)')
        .eq('id', familyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Fetch members with their auth emails via RPC or join
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['family-members-with-email', familyId],
    queryFn: async () => {
      // First get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at');
      
      if (profilesError) throw profilesError;
      
      // For members with user_id, we need to get their email
      // We'll fetch from auth.users via a separate query if needed
      // Since we can't directly join auth.users, we'll display what we have
      return profiles as MemberWithEmail[];
    },
    enabled: open
  });

  // Fetch household settings for PWA install status
  const { data: householdSettings } = useQuery({
    queryKey: ['household-settings', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_settings')
        .select('*')
        .eq('family_id', familyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const { data: moduleOverrides } = useQuery({
    queryKey: ['family-module-overrides', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_module_overrides')
        .select('*')
        .eq('family_id', familyId);
      if (error) throw error;
      return data;
    },
    enabled: open && family?.current_plan?.is_custom
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('families')
        .update({ current_plan_id: planId })
        .eq('id', familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-detail', familyId] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-families'] });
      toast.success('Plan updated successfully');
    },
    onError: () => {
      toast.error('Failed to update plan');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('families')
        .update({ status: 'archived' })
        .eq('id', familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-families'] });
      toast.success('Family archived successfully');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to archive family');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      setIsDeleting(true);
      
      // First, get all the IDs we need for cascading deletes
      const { data: taskData } = await supabase
        .from('tasks')
        .select('id')
        .eq('family_id', familyId);
      const taskIds = taskData?.map(t => t.id) || [];
      
      const { data: goalData } = await supabase
        .from('goals')
        .select('id')
        .eq('family_id', familyId);
      const goalIds = goalData?.map(g => g.id) || [];
      
      const { data: listData } = await supabase
        .from('lists')
        .select('id')
        .eq('family_id', familyId);
      const listIds = listData?.map(l => l.id) || [];
      
      const { data: rewardData } = await supabase
        .from('rewards')
        .select('id')
        .eq('family_id', familyId);
      const rewardIds = rewardData?.map(r => r.id) || [];
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_id', familyId);
      const profileIds = profileData?.map(p => p.id) || [];
      
      // Delete related data in order (respecting foreign keys)
      
      // 1. Delete task-related data
      if (taskIds.length > 0) {
        await supabase.from('task_completions').delete().in('task_id', taskIds);
        await supabase.from('task_assignees').delete().in('task_id', taskIds);
      }
      await supabase.from('tasks').delete().eq('family_id', familyId);
      await supabase.from('task_series').delete().eq('family_id', familyId);
      await supabase.from('materialized_task_instances').delete().in('series_id', 
        (await supabase.from('task_series').select('id').eq('family_id', familyId)).data?.map(s => s.id) || []
      );
      
      // 2. Delete rotating tasks and related data
      await supabase.from('rotation_events').delete().eq('family_id', familyId);
      await supabase.from('rotating_tasks').delete().eq('family_id', familyId);
      
      // 3. Delete events data
      await supabase.from('event_series').delete().eq('family_id', familyId);
      await supabase.from('events').delete().eq('family_id', familyId);
      
      // 4. Delete goals data
      if (goalIds.length > 0) {
        await supabase.from('goal_linked_tasks').delete().in('goal_id', goalIds);
        await supabase.from('goal_milestones').delete().in('goal_id', goalIds);
        await supabase.from('goal_assignees').delete().in('goal_id', goalIds);
        await supabase.from('goal_progress_snapshots').delete().in('goal_id', goalIds);
      }
      await supabase.from('goals').delete().eq('family_id', familyId);
      
      // 5. Delete lists data
      if (listIds.length > 0) {
        // Get list item IDs first for assignees
        const { data: listItemData } = await supabase
          .from('list_items')
          .select('id')
          .in('list_id', listIds);
        const listItemIds = listItemData?.map(li => li.id) || [];
        
        if (listItemIds.length > 0) {
          await supabase.from('list_item_assignees').delete().in('list_item_id', listItemIds);
        }
        await supabase.from('list_items').delete().in('list_id', listIds);
      }
      await supabase.from('lists').delete().eq('family_id', familyId);
      
      // 6. Delete rewards data  
      if (rewardIds.length > 0) {
        await supabase.from('reward_requests').delete().in('reward_id', rewardIds);
      }
      await supabase.from('group_contributions').delete().eq('family_id', familyId);
      await supabase.from('rewards').delete().eq('family_id', familyId);
      
      // 7. Delete celebrations
      await supabase.from('celebrations').delete().eq('family_id', familyId);
      
      // 8. Delete categories
      await supabase.from('categories').delete().eq('family_id', familyId);
      
      // 9. Delete holiday dates
      await supabase.from('holiday_dates').delete().eq('family_id', familyId);
      
      // 10. Delete points ledger
      await supabase.from('points_ledger').delete().eq('family_id', familyId);
      
      // 11. Delete screensaver data
      await supabase.from('screensaver_images').delete().eq('family_id', familyId);
      await supabase.from('screensaver_settings').delete().eq('family_id', familyId);
      
      // 12. Delete public holiday settings
      await supabase.from('public_holiday_settings').delete().eq('family_id', familyId);
      
      // 13. Delete household settings
      await supabase.from('household_settings').delete().eq('family_id', familyId);
      
      // 14. Delete family module overrides
      await supabase.from('family_module_overrides').delete().eq('family_id', familyId);
      
      // 15. Delete calendar integrations and sessions for profiles in this family
      if (profileIds.length > 0) {
        await supabase.from('calendar_integrations').delete().in('profile_id', profileIds);
        await supabase.from('dashboard_sessions').delete().in('active_member_id', profileIds);
      }
      
      // 16. Delete profiles
      await supabase.from('profiles').delete().eq('family_id', familyId);
      
      // 17. Finally delete the family
      const { error } = await supabase
        .from('families')
        .delete()
        .eq('id', familyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-families'] });
      toast.success('Family and all related data deleted successfully');
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error(`Failed to delete family: ${error.message || 'Unknown error'}`);
    },
    onSettled: () => {
      setIsDeleting(false);
    }
  });

  const isCustomPlan = family?.current_plan?.is_custom;
  const parentMembers = members?.filter(m => m.role === 'parent') || [];
  const childMembers = members?.filter(m => m.role === 'child') || [];

  // Determine PWA install status - check if they have any parent with a linked account
  // This is an approximation - true PWA install would need browser-side tracking
  const hasLinkedAccounts = members?.some(m => m.user_id) || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {family?.name || 'Family Details'}
            {family?.status === 'archived' && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            View and manage family details, members, and subscription
          </DialogDescription>
        </DialogHeader>

        {familyLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Signup & Account Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="w-4 h-4" />
                  Account Information
                </Label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">
                      {family?.created_at && format(new Date(family.created_at), 'PPP')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Age:</span>
                    <span className="font-medium">
                      {family?.created_at && formatDistanceToNow(new Date(family.created_at), { addSuffix: false })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="font-medium">
                      {family?.updated_at && formatDistanceToNow(new Date(family.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={family?.status === 'active' ? 'default' : 'secondary'}>
                      {family?.status || 'active'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Smartphone className="w-4 h-4" />
                  App Status
                </Label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Onboarding:</span>
                    <Badge variant={householdSettings?.onboarding_completed ? 'default' : 'secondary'}>
                      {householdSettings?.onboarding_completed ? 'Completed' : 'Incomplete'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Dashboard Mode:</span>
                    <Badge variant={householdSettings?.dashboard_mode_enabled ? 'default' : 'outline'}>
                      {householdSettings?.dashboard_mode_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Linked Accounts:</span>
                    <span className="font-medium">
                      {members?.filter(m => m.user_id).length || 0} / {members?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Parent PIN Required:</span>
                    <Badge variant={householdSettings?.require_parent_pin_for_dashboard ? 'default' : 'outline'}>
                      {householdSettings?.require_parent_pin_for_dashboard ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="space-y-3">
              <Label>Subscription Plan</Label>
              <Select
                value={family?.current_plan_id || ''}
                onValueChange={(value) => updatePlanMutation.mutate(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center gap-2">
                        {plan.name}
                        {plan.is_custom && (
                          <Badge variant="outline" className="text-xs">Custom</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {family?.current_plan?.description && (
                <p className="text-sm text-muted-foreground">
                  {family.current_plan.description}
                </p>
              )}
            </div>

            {/* Module Configuration (only for custom plan) */}
            {isCustomPlan && (
              <div className="space-y-3">
                <Label>Module Configuration</Label>
                <ModuleToggleList
                  familyId={familyId}
                  currentModules={moduleOverrides || []}
                />
              </div>
            )}

            <Separator />

            {/* Parent Accounts Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Parent Accounts ({parentMembers.length})
              </Label>
              {membersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : parentMembers.length > 0 ? (
                <div className="space-y-2">
                  {parentMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarFallback
                          className="text-white font-semibold"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{member.display_name}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {member.user_id ? (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              Linked Account
                            </span>
                          ) : (
                            <span className="text-amber-500 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              No login
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined {formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {member.total_points} pts
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.streak_count} day streak
                        </div>
                      </div>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No parent accounts</p>
              )}
            </div>

            {/* Child Members Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Child Members ({childMembers.length})
              </Label>
              {membersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : childMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {childMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarFallback
                          className="text-white font-semibold text-sm"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground text-sm">{member.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.total_points} pts • {member.streak_count} day streak
                        </div>
                      </div>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {member.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No child members</p>
              )}
            </div>
          </div>
        )}

        {!familyLoading && (
          <>
            <Separator className="my-6" />
            
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setArchiveDialogOpen(true)}
                disabled={family?.status === 'archived'}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Family
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Family'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>

      {/* Archive Confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Family</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{family?.name}"? The family will be moved to the archived section but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate()}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Family Permanently
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <span className="font-semibold text-destructive block">This action cannot be undone!</span>
                <span className="block">
                  Are you sure you want to permanently delete "{family?.name}"? 
                  This will delete ALL associated data including:
                </span>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>All {members?.length || 0} member profiles</li>
                  <li>All tasks, events, and lists</li>
                  <li>All goals and rewards</li>
                  <li>Points history and streaks</li>
                  <li>All settings and configurations</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
