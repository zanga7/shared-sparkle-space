import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Plus, 
  Edit, 
  Archive, 
  ArchiveRestore,
  Trash2,
  Shield,
  Key,
  UserCog,
  GripVertical
} from 'lucide-react';
import { ExtendedProfile, ColorSwatch, ColorSwatches } from '@/types/admin';
import { format } from 'date-fns';
import { AddMemberDialog } from '@/components/admin/AddMemberDialog';
import { SetChildPinDialog } from '@/components/admin/SetChildPinDialog';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const MemberManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<ExtendedProfile[]>([]);
  const [editingMember, setEditingMember] = useState<ExtendedProfile | null>(null);
  const [archivingMember, setArchivingMember] = useState<ExtendedProfile | null>(null);
  const [pinMember, setPinMember] = useState<ExtendedProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    role: 'child' as 'parent' | 'child',
    color: 'sky' as ColorSwatch,
    can_add_for_self: true,
    can_add_for_siblings: false,
    can_add_for_parents: false,
    status: 'active' as 'active' | 'archived'
  });

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  const fetchMemberData = async () => {
    try {
      // Fetch current user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      if (profileData.role !== 'parent') return;

      setProfile(profileData as ExtendedProfile);

      // Fetch family members ordered by sort_order
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      setFamilyMembers((membersData || []) as ExtendedProfile[]);

    } catch (error) {
      console.error('Error fetching member data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load member data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member: ExtendedProfile) => {
    setEditingMember(member);
    setFormData({
      display_name: member.display_name,
      role: member.role,
      color: (member.color as ColorSwatch) || 'sky',
      can_add_for_self: member.can_add_for_self,
      can_add_for_siblings: member.can_add_for_siblings,
      can_add_for_parents: member.can_add_for_parents,
      status: (member.status as 'active' | 'archived') || 'active'
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name.trim(),
          role: formData.role,
          color: formData.color,
          can_add_for_self: formData.can_add_for_self,
          can_add_for_siblings: formData.can_add_for_siblings,
          can_add_for_parents: formData.can_add_for_parents,
          status: formData.status
        })
        .eq('id', editingMember.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member updated successfully',
      });

      setIsEditDialogOpen(false);
      setEditingMember(null);
      fetchMemberData();
    } catch (error) {
      console.error('Error updating member:', error);
      toast({
        title: 'Error',
        description: 'Failed to update member',
        variant: 'destructive'
      });
    }
  };

  const handleArchiveMember = async (member: ExtendedProfile) => {
    try {
      const newStatus = member.status === 'active' ? 'archived' : 'active';
      
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Member ${newStatus === 'archived' ? 'archived' : 'restored'} successfully`,
      });

      setArchivingMember(null);
      fetchMemberData();
    } catch (error) {
      console.error('Error archiving member:', error);
      toast({
        title: 'Error',
        description: 'Failed to update member status',
        variant: 'destructive'
      });
    }
  };

  const resetMemberPIN = async (member: ExtendedProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          pin_hash: null,
          failed_pin_attempts: 0,
          pin_locked_until: null
        })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'PIN reset successfully',
      });

      fetchMemberData();
    } catch (error) {
      console.error('Error resetting PIN:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset PIN',
        variant: 'destructive'
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(activeMembers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update sort_order for all affected items
    try {
      const updatePromises = items.map((member, index) => 
        supabase
          .from('profiles')
          .update({ sort_order: index + 1 })
          .eq('id', member.id)
      );

      await Promise.all(updatePromises);

      toast({
        title: 'Success',
        description: 'Member order updated successfully',
      });

      fetchMemberData();
    } catch (error) {
      console.error('Error updating member order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update member order',
        variant: 'destructive'
      });
    }
  };

  const activeMembers = familyMembers.filter(m => m.status === 'active');
  const archivedMembers = familyMembers.filter(m => m.status === 'archived');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading member data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-8 w-8" />
            Member Management
          </h1>
          <p className="text-muted-foreground">
            Manage family members, roles, and permissions
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyMembers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeMembers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Archived Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{archivedMembers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Members
          </CardTitle>
          <CardDescription>
            Currently active family members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="members">
              {(provided) => (
                <div 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-4"
                >
                  {activeMembers.map((member, index) => (
                    <Draggable key={member.id} draggableId={member.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-4 p-4 border rounded-lg transition-all ${
                            snapshot.isDragging ? 'shadow-lg rotate-1 scale-105' : ''
                          }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center justify-center p-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded"
                          >
                            <GripVertical className="h-4 w-4 text-gray-400" />
                          </div>
                          
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className={ColorSwatches[member.color as ColorSwatch] || ColorSwatches.sky}>
                              {member.display_name[0]}
                            </AvatarFallback>
                          </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{member.display_name}</h3>
                    <Badge variant={member.role === 'parent' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                    <Badge variant="outline" className={ColorSwatches[member.color as ColorSwatch] || ColorSwatches.sky}>
                      {member.color}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Points: {member.total_points} | Streak: {member.streak_count}</div>
                    <div>
                      Permissions: 
                      {member.can_add_for_self && ' Self'}
                      {member.can_add_for_siblings && ' Siblings'}
                      {member.can_add_for_parents && ' Parents'}
                      {!member.can_add_for_self && !member.can_add_for_siblings && !member.can_add_for_parents && ' None'}
                    </div>
                    <div>Created: {format(new Date(member.created_at), 'MMM d, yyyy')}</div>
                  </div>
                </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPinMember(member)}
                              className="gap-1"
                            >
                              <Key className="h-3 w-3" />
                              {member.pin_hash ? 'Update PIN' : 'Set PIN'}
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditMember(member)}
                              className="gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            
                            {member.id !== profile?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setArchivingMember(member)}
                                className="gap-1"
                              >
                                <Archive className="h-3 w-3" />
                                Archive
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Archived Members */}
      {archivedMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archived Members
            </CardTitle>
            <CardDescription>
              Previously archived family members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {archivedMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-4 border rounded-lg opacity-60">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className={ColorSwatches[member.color as ColorSwatch] || ColorSwatches.sky}>
                      {member.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{member.display_name}</h3>
                      <Badge variant="outline">Archived</Badge>
                      <Badge variant={member.role === 'parent' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Final Points: {member.total_points}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setArchivingMember(member)}
                      className="gap-1"
                    >
                      <ArchiveRestore className="h-3 w-3" />
                      Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update member details, role, and permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Enter display name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value: 'parent' | 'child') => 
                  setFormData(prev => ({ ...prev, role: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Color</Label>
                <Select value={formData.color} onValueChange={(value: ColorSwatch) => 
                  setFormData(prev => ({ ...prev, color: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ColorSwatches).map((color) => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${ColorSwatches[color as ColorSwatch]}`} />
                          {color}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value: 'active' | 'archived') => 
                setFormData(prev => ({ ...prev, status: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="can_add_for_self"
                  checked={formData.can_add_for_self}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, can_add_for_self: checked }))
                  }
                />
                <Label htmlFor="can_add_for_self">Can add tasks for self</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="can_add_for_siblings"
                  checked={formData.can_add_for_siblings}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, can_add_for_siblings: checked }))
                  }
                />
                <Label htmlFor="can_add_for_siblings">Can add tasks for siblings</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="can_add_for_parents"
                  checked={formData.can_add_for_parents}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, can_add_for_parents: checked }))
                  }
                />
                <Label htmlFor="can_add_for_parents">Can add tasks for parents</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMember}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <AddMemberDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        familyId={profile?.family_id || ''}
        onMemberAdded={fetchMemberData}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archivingMember} onOpenChange={(open) => !open && setArchivingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archivingMember?.status === 'active' ? 'Archive Member' : 'Restore Member'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archivingMember?.status === 'active' 
                ? `Are you sure you want to archive "${archivingMember?.display_name}"? They will be hidden from task assignments but retained in history.`
                : `Are you sure you want to restore "${archivingMember?.display_name}"? They will become active again.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archivingMember && handleArchiveMember(archivingMember)}>
              {archivingMember?.status === 'active' ? 'Archive' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIN Management Dialog */}
      <SetChildPinDialog
        member={pinMember}
        open={!!pinMember}
        onOpenChange={(open) => !open && setPinMember(null)}
        onPinUpdated={fetchMemberData}
      />
    </div>
  );
};

export default MemberManagement;