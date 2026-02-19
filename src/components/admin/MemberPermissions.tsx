import { useState } from 'react';
import { useAdminContext } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Shield, Settings2, Key } from 'lucide-react';
import { toast } from 'sonner';
import { SetChildPinDialog } from './SetChildPinDialog';
import type { ExtendedProfile } from '@/types/admin';

export function MemberPermissions() {
  const { familyMembers, refreshFamilyMembers } = useAdminContext();
  const [saving, setSaving] = useState(false);
  const [selectedMemberForPin, setSelectedMemberForPin] = useState<ExtendedProfile | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const updateMemberPermissions = async (memberId: string, field: string, value: boolean | string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', memberId);

      if (error) throw error;

      await refreshFamilyMembers();
      toast.success('Member permissions updated successfully');
    } catch (error) {
      console.error('Error updating member permissions:', error);
      toast.error('Failed to update member permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Member Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Member Permissions
          </CardTitle>
          <CardDescription>
            Configure PIN requirements and permissions for each family member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar 
                    name={member.display_name} 
                    color={member.color}
                    avatarIcon={member.avatar_url || undefined}
                    size="sm" 
                  />
                  <div className="flex-1">
                    <div className="font-medium">{member.display_name}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'parent' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      {member.pin_type && (
                        <Badge variant="outline" className="text-xs">
                          PIN Set
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMemberForPin(member);
                      setPinDialogOpen(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    {member.pin_type ? 'Reset PIN' : 'Set PIN'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Task Completion PIN */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Require PIN for Task Completion</Label>
                      <p className="text-xs text-muted-foreground">
                        Member must enter PIN to complete tasks
                      </p>
                    </div>
                    <Switch
                      checked={member.require_pin_to_complete_tasks || false}
                      onCheckedChange={(checked) => {
                         if (checked && !member.pin_type) {
                          toast.error('Please set a PIN for this member first');
                          return;
                        }
                        updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', checked);
                      }}
                      disabled={saving}
                    />
                  </div>

                  {/* List Deletion PIN */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Require PIN for List Deletions</Label>
                      <p className="text-xs text-muted-foreground">
                        Member must enter PIN for destructive list actions
                      </p>
                    </div>
                    <Switch
                      checked={member.require_pin_for_list_deletes || false}
                      onCheckedChange={(checked) => {
                        if (checked && !member.pin_type) {
                          toast.error('Please set a PIN for this member first');
                          return;
                        }
                        updateMemberPermissions(member.id, 'require_pin_for_list_deletes', checked);
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Calendar Edit Permission */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Calendar Edit Permission</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={member.calendar_edit_permission === 'open' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateMemberPermissions(member.id, 'calendar_edit_permission', 'open')}
                      disabled={saving}
                    >
                      Open Access
                    </Button>
                    <Button
                      variant={member.calendar_edit_permission === 'require_pin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateMemberPermissions(member.id, 'calendar_edit_permission', 'require_pin')}
                      disabled={saving}
                    >
                      Require PIN
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permission Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Permission Presets
          </CardTitle>
          <CardDescription>
            Quick configuration templates for common household setups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Open Household</CardTitle>
                <CardDescription className="text-xs">
                  No PIN requirements, everyone can do everything
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    // Apply open preset to all members
                    familyMembers.forEach(member => {
                      updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', false);
                      updateMemberPermissions(member.id, 'require_pin_for_list_deletes', false);
                      updateMemberPermissions(member.id, 'calendar_edit_permission', 'open');
                    });
                  }}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Guided</CardTitle>
                <CardDescription className="text-xs">
                  PINs required for task completion, open for lists/calendar
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    // Apply guided preset to all members
                    familyMembers.forEach(member => {
                      updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', true);
                      updateMemberPermissions(member.id, 'require_pin_for_list_deletes', false);
                      updateMemberPermissions(member.id, 'calendar_edit_permission', 'open');
                    });
                  }}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Locked</CardTitle>
                <CardDescription className="text-xs">
                  PINs required for all actions to prevent accidental changes
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    // Apply locked preset to all members
                    familyMembers.forEach(member => {
                      updateMemberPermissions(member.id, 'require_pin_to_complete_tasks', true);
                      updateMemberPermissions(member.id, 'require_pin_for_list_deletes', true);
                      updateMemberPermissions(member.id, 'calendar_edit_permission', 'require_pin');
                    });
                  }}
                >
                  Apply
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <SetChildPinDialog
        member={selectedMemberForPin}
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onPinUpdated={refreshFamilyMembers}
      />
    </div>
  );
}