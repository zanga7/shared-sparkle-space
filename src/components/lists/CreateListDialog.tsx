import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
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
import { ShoppingCart, Tent, List as ListIcon } from 'lucide-react';

interface Profile {
  id: string;
  family_id: string;
}

interface Template {
  id: string;
  name: string;
  list_type: string;
  template_items: any;
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    list_type: 'custom' as string
  });

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('list_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates((data || []) as Template[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
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
          list_type: formData.list_type,
          created_by: profile.id
        })
        .select()
        .single();

      if (listError) throw listError;

      // Apply template if selected
      if (selectedTemplate) {
        const template = templates.find(t => t.id === selectedTemplate);
        if (template && template.template_items) {
          const items: any[] = [];
          let sortOrder = 0;

          // Flatten template items into list items
          template.template_items.forEach((section: any) => {
            if (section.items) {
              section.items.forEach((itemName: string) => {
                items.push({
                  list_id: newList.id,
                  name: itemName,
                  category: section.category || section.name,
                  sort_order: sortOrder++,
                  created_by: profile.id
                });
              });
            }
          });

          if (items.length > 0) {
            const { error: itemsError } = await supabase
              .from('list_items')
              .insert(items);

            if (itemsError) throw itemsError;
          }
        }
      }

      toast({
        title: 'List created',
        description: 'Your new list has been created successfully'
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        list_type: 'custom'
      });
      setSelectedTemplate(null);
      
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'shopping':
        return <ShoppingCart className="h-4 w-4" />;
      case 'camping':
        return <Tent className="h-4 w-4" />;
      default:
        return <ListIcon className="h-4 w-4" />;
    }
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({ ...prev, list_type: type }));
    // Auto-select first template of the same type
    const typeTemplates = templates.filter(t => t.list_type === type);
    if (typeTemplates.length > 0) {
      setSelectedTemplate(typeTemplates[0].id);
    } else {
      setSelectedTemplate(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
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

          <div className="space-y-2">
            <Label>List Type</Label>
            <Select value={formData.list_type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shopping">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Shopping
                  </div>
                </SelectItem>
                <SelectItem value="camping">
                  <div className="flex items-center gap-2">
                    <Tent className="h-4 w-4" />
                    Camping
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <ListIcon className="h-4 w-4" />
                    Custom
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Templates */}
          {templates.filter(t => t.list_type === formData.list_type).length > 0 && (
            <div className="space-y-2">
              <Label>Apply Template (Optional)</Label>
              <div className="grid grid-cols-1 gap-2">
                {templates
                  .filter(t => t.list_type === formData.list_type)
                  .map(template => (
                    <div
                      key={template.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplate === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedTemplate(
                        selectedTemplate === template.id ? null : template.id
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(template.list_type)}
                        <span className="font-medium">{template.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {template.template_items.slice(0, 3).map((section: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {section.name}
                          </Badge>
                        ))}
                        {template.template_items.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.template_items.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
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