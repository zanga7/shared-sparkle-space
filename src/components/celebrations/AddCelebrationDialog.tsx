import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CelebrationIconPicker } from './CelebrationIconPicker';
import { Loader2, X } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';

interface AddCelebrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  profileId: string;
}

export const AddCelebrationDialog = ({ open, onOpenChange, familyId, profileId }: AddCelebrationDialogProps) => {
  const queryClient = useQueryClient();
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string>();
  const [formData, setFormData] = useState({
    name: '', celebration_type: 'birthday' as 'birthday' | 'anniversary' | 'other',
    month: '', day: '', year_specific: '', visual_type: 'icon' as 'photo' | 'icon',
    photo_url: '', icon_id: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const celebrationDate = `2000-${formData.month}-${formData.day}`;
      const { error } = await supabase.from('celebrations').insert({
        family_id: familyId, created_by: profileId, name: formData.name,
        celebration_type: formData.celebration_type, celebration_date: celebrationDate,
        year_specific: formData.year_specific ? parseInt(formData.year_specific) : null,
        visual_type: formData.visual_type,
        photo_url: formData.visual_type === 'photo' ? uploadedPhotoPath : null,
        icon_id: formData.visual_type === 'icon' ? formData.icon_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['celebrations'] });
      toast.success('Celebration added');
      onOpenChange(false);
      setFormData({ name: '', celebration_type: 'birthday', month: '', day: '', year_specific: '', visual_type: 'icon', photo_url: '', icon_id: '' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Celebration</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} required /></div>
          <div><Label>Type *</Label><Select value={formData.celebration_type} onValueChange={(v) => setFormData(p => ({ ...p, celebration_type: v as any }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="birthday">Birthday</SelectItem><SelectItem value="anniversary">Anniversary</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Month *</Label><Select value={formData.month} onValueChange={(v) => setFormData(p => ({ ...p, month: v }))}><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => { const m = (i + 1).toString().padStart(2, '0'); const n = new Date(2000, i, 1).toLocaleString('default', { month: 'long' }); return <SelectItem key={m} value={m}>{n}</SelectItem>; })}</SelectContent></Select></div>
            <div><Label>Day *</Label><Select value={formData.day} onValueChange={(v) => setFormData(p => ({ ...p, day: v }))}><SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger><SelectContent>{Array.from({ length: 31 }, (_, i) => { const d = (i + 1).toString().padStart(2, '0'); return <SelectItem key={d} value={d}>{i + 1}</SelectItem>; })}</SelectContent></Select></div>
          </div>
          <div><Label>Year (Optional)</Label><Input type="number" value={formData.year_specific} onChange={(e) => setFormData(p => ({ ...p, year_specific: e.target.value }))} placeholder="e.g., 1990" /><p className="text-xs text-muted-foreground mt-1">For birthdays, helps calculate age</p></div>
          <div><Label>Visual *</Label><RadioGroup value={formData.visual_type} onValueChange={(v: any) => setFormData(p => ({ ...p, visual_type: v }))} className="flex gap-4"><div className="flex items-center gap-2"><RadioGroupItem value="icon" id="icon" /><label htmlFor="icon">Icon</label></div><div className="flex items-center gap-2"><RadioGroupItem value="photo" id="photo" /><label htmlFor="photo">Photo</label></div></RadioGroup></div>
          {formData.visual_type === 'photo' && <div><Label>Photo *</Label><ImageUpload value={uploadedPhotoPath} onChange={setUploadedPhotoPath} bucket="celebration-photos" path={`${familyId}/`} /></div>}
          {formData.visual_type === 'icon' && <div><Label>Icon *</Label><CelebrationIconPicker selectedIconId={formData.icon_id} onSelectIcon={(id) => setFormData(p => ({ ...p, icon_id: id }))} /></div>}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
