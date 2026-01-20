import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import { AvatarIconSelector, AvatarIconType } from '@/components/ui/avatar-icon-selector';

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
}

interface InviteParentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  onParentAdded: () => void;
  existingMembers: Array<{ color: string; avatar_url?: string | null; status: string }>;
}

export function InviteParentDialog({
  isOpen,
  onOpenChange,
  familyId,
  onParentAdded,
  existingMembers
}: InviteParentDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    color: 'sky' as string,
    avatar_icon: '' as string,
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
        description: 'This color is already in use by another member',
        variant: 'destructive'
      });
      return;
    }

    if (iconInUse) {
      toast({
        title: 'Error',
        description: 'This icon is already in use by another member',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create a parent profile without user_id - they can link later
      const { error } = await supabase
        .from('profiles')
        .insert({
          family_id: familyId,
          display_name: formData.display_name.trim(),
          role: 'parent',
          color: formData.color,
          avatar_url: formData.avatar_icon || null,
          status: 'active', // Active so they appear in the family
        });

      if (error) throw error;

      toast({
        title: 'Parent added!',
        description: `${formData.display_name} has been added to your family.`,
      });

      // Reset form
      setFormData({
        display_name: '',
        color: colors[0]?.color_key || 'sky',
        avatar_icon: '',
      });

      onOpenChange(false);
      onParentAdded();
    } catch (error) {
      console.error('Error adding parent:', error);
      toast({
        title: 'Error',
        description: 'Failed to add parent profile',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Another Parent
          </DialogTitle>
          <DialogDescription>
            Add a parent or guardian to help manage the family. They can set up their own login later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="parent_display_name">Display Name</Label>
            <Input
              id="parent_display_name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="e.g., Mom, Dad, Sarah"
              required
            />
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
                      className={isUsed ? 'opacity-50' : ''}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-4 h-4 rounded-full border-2 ${isUsed ? 'border-muted-foreground' : 'border-border'}`}
                          style={{ backgroundColor: color.hex_value }}
                        />
                        <span className={isUsed ? 'line-through text-muted-foreground' : ''}>
                          {color.name}
                        </span>
                        {isUsed && (
                          <span className="text-xs text-destructive ml-1">(taken)</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
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

          <div className="flex justify-end space-x-2 mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Parent'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
