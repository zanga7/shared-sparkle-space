import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AddCustomRegionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (region: { code: string; name: string; flag: string }) => void;
}

export const AddCustomRegionDialog = ({
  open,
  onOpenChange,
  onAdd,
}: AddCustomRegionDialogProps) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    flag: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name || !formData.flag) {
      toast.error('Please fill in all fields');
      return;
    }

    onAdd(formData);
    setFormData({ code: '', name: '', flag: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Region</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Region Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., FR, JP, BR"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use ISO 3166 country codes or custom codes for states (e.g., US-CA)
            </p>
          </div>

          <div>
            <Label htmlFor="name">Region Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., France, Japan, Brazil"
              required
            />
          </div>

          <div>
            <Label htmlFor="flag">Flag Emoji *</Label>
            <Input
              id="flag"
              value={formData.flag}
              onChange={(e) => setFormData(prev => ({ ...prev, flag: e.target.value }))}
              placeholder="e.g., 🇫🇷, 🇯🇵, 🇧🇷"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Copy and paste a flag emoji
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Region
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
