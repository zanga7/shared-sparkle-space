import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as Icons from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Profile {
  id: string;
  family_id: string;
}


interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onListCreated: () => void;
  profile: Profile;
}

export function CreateListDialog({ 
  open, 
  onOpenChange, 
  onListCreated, 
  profile 
}: CreateListDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '' as string
  });

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);


  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_id', profile.family_id)
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
    if (!profile || !formData.name.trim()) return;

    try {
      setLoading(true);

      // Create the list
      const { data: newList, error: listError } = await supabase
        .from('lists')
        .insert({
          family_id: profile.family_id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category_id: formData.category_id === 'none' ? null : formData.category_id || null,
          created_by: profile.id
        })
        .select()
        .single();

      if (listError) throw listError;


      toast({
        title: 'List created',
        description: 'Your new list has been created successfully'
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        category_id: ''
      });
      
      
      onListCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating list:', error);
      toast({
        title: 'Error',
        description: 'Failed to create list',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
          <DialogDescription>
            Create a new list for your family to organize tasks, shopping, or activities.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">List Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter list name..."
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter list description..."
              rows={3}
            />
          </div>


          {/* Category Selection */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>Category (Optional)</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
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


          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? 'Creating...' : 'Create List'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}