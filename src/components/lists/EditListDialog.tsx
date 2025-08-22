import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import * as Icons from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  family_id: string;
}

interface EditListDialogProps {
  list: {
    id: string;
    name: string;
    description?: string;
    list_type: string;
    category_id?: string;
    family_id: string;
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
  const [categoryId, setCategoryId] = useState(list.category_id || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(list.name);
      setDescription(list.description || '');
      setListType(list.list_type);
      setCategoryId(list.category_id || '');
      fetchCategories();
    }
  }, [open, list]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_id', list.family_id)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const renderIcon = (iconName: string, className = "h-4 w-4") => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent ? <IconComponent className={className} /> : <Icons.Tag className={className} />;
  };

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      'sky': 'bg-sky-100 text-sky-800 border-sky-200',
      'rose': 'bg-rose-100 text-rose-800 border-rose-200',
      'emerald': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'amber': 'bg-amber-100 text-amber-800 border-amber-200',
      'violet': 'bg-violet-100 text-violet-800 border-violet-200',
      'orange': 'bg-orange-100 text-orange-800 border-orange-200',
      'cyan': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'pink': 'bg-pink-100 text-pink-800 border-pink-200',
    };
    return colorMap[color] || colorMap['sky'];
  };

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
          category_id: categoryId || null,
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
          
          {/* Category Selection */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">
                Category (Optional)
              </label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <span className="text-muted-foreground">No category</span>
                  </SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        {renderIcon(category.icon)}
                        <span>{category.name}</span>
                        <Badge variant="outline" className={`text-xs ${getColorClass(category.color)}`}>
                          {category.color}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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