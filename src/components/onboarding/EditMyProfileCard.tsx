import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit, Check } from 'lucide-react';
import { AvatarIconSelector, AvatarIconType } from '@/components/ui/avatar-icon-selector';
import { UserAvatar } from '@/components/ui/user-avatar';

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
}

interface EditMyProfileCardProps {
  profileId: string;
  displayName: string;
  color: string;
  avatarUrl: string | null;
  existingMembers: Array<{ id: string; color: string; avatar_url?: string | null; status: string }>;
  onProfileUpdated: () => void;
}

export function EditMyProfileCard({
  profileId,
  displayName,
  color,
  avatarUrl,
  existingMembers,
  onProfileUpdated
}: EditMyProfileCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: displayName,
    color: color,
    avatar_icon: avatarUrl || ''
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { display_name: string; color: string; avatar_url: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', profileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.'
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      onProfileUpdated();
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    }
  });

  // Get other members (exclude self) for collision detection
  const otherMembers = existingMembers.filter(m => m.id !== profileId);

  const handleSave = () => {
    if (!formData.display_name.trim()) {
      toast({
        title: 'Error',
        description: 'Display name is required',
        variant: 'destructive'
      });
      return;
    }

    // Validate uniqueness
    const colorInUse = otherMembers.some(m => 
      m.color === formData.color && m.status === 'active'
    );
    const iconInUse = formData.avatar_icon && otherMembers.some(m => 
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

    updateMutation.mutate({
      display_name: formData.display_name.trim(),
      color: formData.color,
      avatar_url: formData.avatar_icon || null
    });
  };

  if (!isEditing) {
    return (
      <Card className="border-2 border-dashed border-primary/40 bg-primary/5 hover:border-primary/60 transition-colors cursor-pointer" onClick={() => setIsEditing(true)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={displayName}
                color={color}
                avatarIcon={avatarUrl || undefined}
                size="md"
              />
              <div className="flex-1">
                <p className="font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">Your Profile (Parent)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <Edit className="h-4 w-4" />
              <span className="text-sm font-medium">Click to customize</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Customize Your Profile</CardTitle>
        <CardDescription>Choose your display name, color, and avatar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="my_display_name">Display Name</Label>
          <Input
            id="my_display_name"
            value={formData.display_name}
            onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
            placeholder="Your name"
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
              {colors.map((colorOption) => {
                const isUsed = otherMembers.some(m => 
                  m.color === colorOption.color_key && m.status === 'active'
                );
                return (
                  <SelectItem 
                    key={colorOption.id} 
                    value={colorOption.color_key}
                    disabled={isUsed}
                    className={isUsed ? 'opacity-50' : ''}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-4 h-4 rounded-full border-2 ${isUsed ? 'border-muted-foreground' : 'border-border'}`}
                        style={{ backgroundColor: colorOption.hex_value }}
                      />
                      <span className={isUsed ? 'line-through text-muted-foreground' : ''}>
                        {colorOption.name}
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
            usedIcons={otherMembers
              .filter(m => m.status === 'active')
              .map(m => m.avatar_url)
              .filter(Boolean) as string[]}
            onIconSelect={(icon: AvatarIconType) => 
              setFormData(prev => ({ ...prev, avatar_icon: icon }))
            }
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setFormData({
                display_name: displayName,
                color: color,
                avatar_icon: avatarUrl || ''
              });
              setIsEditing(false);
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
