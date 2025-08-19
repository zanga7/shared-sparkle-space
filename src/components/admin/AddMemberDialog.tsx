import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { ColorSwatch, ColorSwatches } from '@/types/admin';

interface AddMemberDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  onMemberAdded: () => void;
}

export const AddMemberDialog = ({ isOpen, onOpenChange, familyId, onMemberAdded }: AddMemberDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    role: 'child' as 'parent' | 'child',
    color: 'sky' as ColorSwatch,
    can_add_for_self: true,
    can_add_for_siblings: false,
    can_add_for_parents: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.display_name.trim()) {
      toast({
        title: 'Error',
        description: 'Display name is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          family_id: familyId,
          display_name: formData.display_name.trim(),
          role: formData.role,
          color: formData.color,
          can_add_for_self: formData.can_add_for_self,
          can_add_for_siblings: formData.can_add_for_siblings,
          can_add_for_parents: formData.can_add_for_parents,
          user_id: crypto.randomUUID(), // Temporary user_id for child members
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member added successfully',
      });

      // Reset form
      setFormData({
        display_name: '',
        role: 'child',
        color: 'sky',
        can_add_for_self: true,
        can_add_for_siblings: false,
        can_add_for_parents: false,
      });

      onOpenChange(false);
      onMemberAdded();
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: 'Error',
        description: 'Failed to add member',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Create a new family member profile
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="Enter display name"
              required
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

          <div className="flex justify-end space-x-2 mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};