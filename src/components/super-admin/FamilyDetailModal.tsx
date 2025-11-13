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
import { Archive, Trash2 } from 'lucide-react';

interface FamilyDetailModalProps {
  familyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FamilyDetailModal({ familyId, open, onOpenChange }: FamilyDetailModalProps) {
  const queryClient = useQueryClient();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['family-members', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', familyId)
        .order('sort_order');
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
      const { error } = await supabase
        .from('families')
        .delete()
        .eq('id', familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-families'] });
      toast.success('Family deleted successfully');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to delete family');
    }
  });

  const isCustomPlan = family?.current_plan?.is_custom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{family?.name || 'Family Details'}</DialogTitle>
          <DialogDescription>
            Manage family plan and view member information
          </DialogDescription>
        </DialogHeader>

        {familyLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
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

            {/* Family Members */}
            <div className="space-y-3">
              <Label>Family Members ({members?.length || 0})</Label>
              {membersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarFallback
                          className="text-white font-semibold"
                          style={{ backgroundColor: `hsl(var(--${member.color}))` }}
                        >
                          {member.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{member.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.role === 'parent' ? '👤 Parent' : '👶 Child'}
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
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Family
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
            <AlertDialogTitle>Delete Family</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-destructive">This action cannot be undone!</p>
              <p>Are you sure you want to permanently delete "{family?.name}"? This will delete all associated data including tasks, events, lists, and member profiles.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
