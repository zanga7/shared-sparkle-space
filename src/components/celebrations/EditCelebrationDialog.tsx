import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Celebration } from '@/types/celebration';
import { CelebrationIconPicker } from './CelebrationIconPicker';
import { Loader2, Upload, X } from 'lucide-react';

interface EditCelebrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  celebration: Celebration;
  familyId: string;
}

export const EditCelebrationDialog = ({
  open,
  onOpenChange,
  celebration,
  familyId,
}: EditCelebrationDialogProps) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: celebration.name,
    celebration_type: celebration.celebration_type,
    month: '',
    day: '',
    year_specific: celebration.year_specific?.toString() || '',
    visual_type: celebration.visual_type,
    photo_url: celebration.photo_url || '',
    icon_id: celebration.icon_id || '',
  });

  useEffect(() => {
    if (celebration) {
      const date = new Date(celebration.celebration_date);
      setFormData({
        name: celebration.name,
        celebration_type: celebration.celebration_type,
        month: (date.getMonth() + 1).toString().padStart(2, '0'),
        day: date.getDate().toString().padStart(2, '0'),
        year_specific: celebration.year_specific?.toString() || '',
        visual_type: celebration.visual_type,
        photo_url: celebration.photo_url || '',
        icon_id: celebration.icon_id || '',
      });
    }
  }, [celebration]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Construct date from month and day (use 2000 as placeholder year)
      const celebrationDate = `2000-${formData.month}-${formData.day}`;

      const updates: any = {
        name: formData.name,
        celebration_type: formData.celebration_type,
        celebration_date: celebrationDate,
        year_specific: formData.year_specific ? parseInt(formData.year_specific) : null,
        visual_type: formData.visual_type,
        photo_url: formData.visual_type === 'photo' ? formData.photo_url : null,
        icon_id: formData.visual_type === 'icon' ? formData.icon_id : null,
      };

      const { error } = await supabase
        .from('celebrations')
        .update(updates)
        .eq('id', celebration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['celebrations'] });
      toast.success('Celebration updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to update celebration: ' + error.message);
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${familyId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('celebration-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('celebration-photos')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, photo_url: urlData.publicUrl }));
      toast.success('Photo uploaded successfully');
    } catch (error: any) {
      toast.error('Failed to upload photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.month || !formData.day) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.visual_type === 'photo' && !formData.photo_url) {
      toast.error('Please upload a photo or select an icon');
      return;
    }

    if (formData.visual_type === 'icon' && !formData.icon_id) {
      toast.error('Please select an icon');
      return;
    }

    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Celebration</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., John's Birthday"
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.celebration_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, celebration_type: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="month">Month *</Label>
              <Select
                value={formData.month}
                onValueChange={(value) => setFormData(prev => ({ ...prev, month: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthNum = (i + 1).toString().padStart(2, '0');
                    const monthName = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
                    return (
                      <SelectItem key={monthNum} value={monthNum}>
                        {monthName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="day">Day *</Label>
              <Select
                value={formData.day}
                onValueChange={(value) => setFormData(prev => ({ ...prev, day: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => {
                    const dayNum = (i + 1).toString().padStart(2, '0');
                    return (
                      <SelectItem key={dayNum} value={dayNum}>
                        {i + 1}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="year">Year (Optional - for age calculation)</Label>
            <Input
              id="year"
              type="number"
              value={formData.year_specific}
              onChange={(e) => setFormData(prev => ({ ...prev, year_specific: e.target.value }))}
              placeholder="e.g., 1990"
              min="1900"
              max={new Date().getFullYear()}
            />
            <p className="text-xs text-muted-foreground mt-1">
              For birthdays, this helps calculate the age
            </p>
          </div>

          <div>
            <Label>Visual *</Label>
            <Select
              value={formData.visual_type}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                visual_type: value as 'photo' | 'icon',
                photo_url: value === 'icon' ? '' : prev.photo_url,
                icon_id: value === 'photo' ? '' : prev.icon_id,
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="icon">Icon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.visual_type === 'photo' && (
            <div className="space-y-2">
              {formData.photo_url && (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                  <img 
                    src={formData.photo_url} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              <div>
                <Label htmlFor="photo">
                  {formData.photo_url ? 'Change Photo' : 'Upload Photo *'}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="flex-1"
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            </div>
          )}

          {formData.visual_type === 'icon' && (
            <div>
              <Label>Select Icon *</Label>
              <CelebrationIconPicker
                value={formData.icon_id}
                onChange={(iconId) => setFormData(prev => ({ ...prev, icon_id: iconId }))}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Celebration
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
