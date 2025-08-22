import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, MoreVertical, Edit3, Trash2 } from 'lucide-react';
import * as Icons from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
}

const colorOptions = [
  { value: 'sky', label: 'Sky', class: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'rose', label: 'Rose', class: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'violet', label: 'Violet', class: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-100 text-pink-800 border-pink-200' },
];

const iconOptions = [
  'ShoppingCart', 'Apple', 'Beef', 'Milk', 'Bread', 'Carrot',
  'Fish', 'Coffee', 'Cake', 'Beer', 'Wine', 'Utensils',
  'Home', 'Shirt', 'Car', 'Fuel', 'Pill', 'Heart',
  'Baby', 'PawPrint', 'Flower', 'Book', 'Gamepad2', 'Headphones'
];

export function CategoryManager({ open, onOpenChange, familyId }: CategoryManagerProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: 'sky',
    icon: 'Tag'
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open, familyId]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load categories',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async () => {
    if (!newCategory.name.trim()) return;

    try {
      const maxSortOrder = Math.max(...categories.map(c => c.sort_order), -1);
      
      const { error } = await supabase
        .from('categories')
        .insert({
          family_id: familyId,
          name: newCategory.name.trim(),
          color: newCategory.color,
          icon: newCategory.icon,
          sort_order: maxSortOrder + 1,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      setNewCategory({ name: '', color: 'sky', icon: 'Tag' });
      fetchCategories();
      
      toast({
        title: 'Category created',
        description: 'New category has been added'
      });
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: 'Error',
        description: 'Failed to create category',
        variant: 'destructive'
      });
    }
  };

  const updateCategory = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: category.name,
          color: category.color,
          icon: category.icon
        })
        .eq('id', category.id);

      if (error) throw error;

      setEditingCategory(null);
      fetchCategories();
      
      toast({
        title: 'Category updated',
        description: 'Category has been updated successfully'
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: 'Error',
        description: 'Failed to update category',
        variant: 'destructive'
      });
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', categoryId);

      if (error) throw error;

      fetchCategories();
      
      toast({
        title: 'Category deleted',
        description: 'Category has been removed'
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive'
      });
    }
  };

  const getColorClass = (color: string) => {
    return colorOptions.find(c => c.value === color)?.class || colorOptions[0].class;
  };

  const renderIcon = (iconName: string, className = "h-4 w-4") => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent ? <IconComponent className={className} /> : <Icons.Tag className={className} />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Add New Category */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Add New Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder="Category name"
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createCategory();
                  }
                }}
              />
              <Select 
                value={newCategory.color} 
                onValueChange={(value) => setNewCategory(prev => ({ ...prev, color: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color.class.split(' ')[0]}`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={newCategory.icon} 
                onValueChange={(value) => setNewCategory(prev => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map(icon => (
                    <SelectItem key={icon} value={icon}>
                      <div className="flex items-center gap-2">
                        {renderIcon(icon)}
                        {icon}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createCategory} disabled={!newCategory.name.trim()} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>

          {/* Categories List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            <h3 className="font-medium">Existing Categories ({categories.length})</h3>
            {categories.map(category => (
              <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                {editingCategory?.id === category.id ? (
                  <div className="flex items-center gap-3 flex-1">
                    <Input
                      value={editingCategory.name}
                      onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="flex-1"
                    />
                    <Select 
                      value={editingCategory.color} 
                      onValueChange={(value) => setEditingCategory(prev => prev ? { ...prev, color: value } : null)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map(color => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${color.class.split(' ')[0]}`} />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => updateCategory(editingCategory)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingCategory(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {renderIcon(category.icon || 'Tag')}
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="outline" className={getColorClass(category.color)}>
                        {category.color}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteCategory(category.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No categories yet. Create your first category above.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}