import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditListDialogProps {
  list: {
    id: string;
    name: string;
    description?: string;
    list_type: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onListUpdated: () => void;
}

export function EditListDialog({ 
  list, 
  open, 
  onOpenChange, 
  onListUpdated 
}: EditListDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || '');
  const [listType, setListType] = useState(list.list_type);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(list.name);
      setDescription(list.description || '');
      setListType(list.list_type);
    }
  }, [open, list]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('lists')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          list_type: listType,
          updated_at: new Date().toISOString()
        })
        .eq('id', list.id);

      if (error) throw error;

      toast({
        title: 'List updated',
        description: 'List has been updated successfully'
      });

      onListUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating list:', error);
      toast({
        title: 'Error',
        description: 'Failed to update list',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit List</DialogTitle>
          <DialogDescription>
            Update your list information and settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              List Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter list name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter list description"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">
              List Type
            </label>
            <Select value={listType} onValueChange={setListType}>
              <SelectTrigger>
                <SelectValue placeholder="Select list type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shopping">Shopping</SelectItem>
                <SelectItem value="camping">Camping</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Updating...' : 'Update List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}