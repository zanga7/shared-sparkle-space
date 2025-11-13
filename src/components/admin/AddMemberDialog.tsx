import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { AvatarIconSelector, AvatarIconType } from '@/components/ui/avatar-icon-selector';

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
}

interface AddMemberDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  onMemberAdded: () => void;
  existingMembers?: Array<{ color: string; avatar_url?: string | null; status: string }>;
}

export const AddMemberDialog = ({ isOpen, onOpenChange, familyId, onMemberAdded, existingMembers = [] }: AddMemberDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    role: 'child' as 'parent' | 'child',
    color: 'sky' as string,
    avatar_icon: '' as string,
    can_add_for_self: true,
    can_add_for_siblings: false,
    can_add_for_parents: false,
  });

  // Fetch available colors from database
  const { data: colors = [] } = useQuery({
    queryKey: ['color-palettes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_palettes')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ColorPalette[];
    }
  });

  // Set default color when colors are loaded
  useEffect(() => {
    if (colors.length > 0 && !formData.color) {
      setFormData(prev => ({ ...prev, color: colors[0].color_key }));
    }
  }, [colors]);

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

    // Validate uniqueness
    const colorInUse = existingMembers.some(m => 
      m.color === formData.color && m.status === 'active'
    );
    const iconInUse = formData.avatar_icon && existingMembers.some(m => 
      m.avatar_url === formData.avatar_icon && m.status === 'active'
    );

    if (colorInUse) {
      toast({
        title: 'Error',
        description: 'This color is already in use by another active member',
        variant: 'destructive'
      });
      return;
    }

    if (iconInUse) {
      toast({
        title: 'Error',
        description: 'This icon is already in use by another active member',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const insertData: any = {
        family_id: familyId,
        display_name: formData.display_name.trim(),
        role: formData.role,
        color: formData.color,
        avatar_url: formData.avatar_icon || null,
        can_add_for_self: formData.can_add_for_self,
        can_add_for_siblings: formData.can_add_for_siblings,
        can_add_for_parents: formData.can_add_for_parents,
        status: 'active'
      };
      
      // Only add user_id for parents (children will have null user_id)
      if (formData.role === 'parent') {
        // For now, parents need to be created through auth signup
        // This would require implementing a proper parent invitation system
        toast({
          title: 'Not Supported',
          description: 'Parent accounts must be created through the authentication system. Only child accounts can be added here.',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member added successfully',
      });

      // Reset form
      setFormData({
        display_name: '',
        role: 'child',
        color: colors[0]?.color_key || 'sky',
        avatar_icon: '',
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
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="parent" disabled>Parent (use auth signup)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Color</Label>
              <Select 
                value={formData.color} 
                onValueChange={(value: string) => 
                  setFormData(prev => ({ ...prev, color: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => {
                    const isUsed = existingMembers.some(m => 
                      m.color === color.color_key && m.status === 'active'
                    );
                    return (
                      <SelectItem 
                        key={color.id} 
                        value={color.color_key}
                        disabled={isUsed}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border border-border" 
                            style={{ backgroundColor: color.hex_value }}
                          />
                          {color.name}
                          {isUsed && <span className="text-xs text-muted-foreground">(in use)</span>}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Avatar Icon</Label>
            <AvatarIconSelector
              selectedIcon={formData.avatar_icon}
              selectedColor={formData.color}
              selectedColorHex={colors.find(c => c.color_key === formData.color)?.hex_value}
              usedIcons={existingMembers
                .filter(m => m.status === 'active')
                .map(m => m.avatar_url)
                .filter(Boolean) as string[]}
              onIconSelect={(icon: AvatarIconType) => 
                setFormData(prev => ({ ...prev, avatar_icon: icon }))
              }
            />
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