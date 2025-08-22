import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { TaskAssigneesDisplay } from '@/components/ui/task-assignees-display';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Calendar,
  Hash,
  User,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface Profile {
  id: string;
  family_id: string;
  display_name: string;
  role: 'parent' | 'child';
  color?: string;
  total_points?: number;
}

interface ListItem {
  id: string;
  name: string;
  notes?: string;
  quantity: number;
  category?: string;
  due_date?: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  sort_order: number;
  assignees?: {
    profile: Profile;
  }[];
}

interface List {
  id: string;
  name: string;
  description?: string;
  list_type: string;
  is_archived: boolean;
}

interface ListDetailDialogProps {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onListUpdated: () => void;
  profile: Profile;
}

export function ListDetailDialog({ 
  list, 
  open, 
  onOpenChange, 
  onListUpdated, 
  profile 
}: ListDetailDialogProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ListItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [assigningItem, setAssigningItem] = useState<string | null>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchItems();
      fetchFamilyMembers();
      // Auto-focus input when dialog opens
      setTimeout(() => {
        newItemInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          *,
          assignees:list_item_assignees(
            profile:profiles(id, display_name, role, color)
          )
        `)
        .eq('list_id', list.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setItems((data || []) as unknown as ListItem[]);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load list items',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, family_id, display_name, role, color, total_points')
        .eq('family_id', profile.family_id)
        .eq('status', 'active')
        .order('display_name');

      if (error) throw error;
      setFamilyMembers((data || []) as Profile[]);
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  const parseItemText = (text: string) => {
    let name = text.trim();
    let quantity = 1;
    let category = '';
    let notes = '';
    
    // Parse quantity (x2, 2x, etc.)
    const quantityMatch = name.match(/\b(\d+)x\b|\bx(\d+)\b/i);
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1] || quantityMatch[2]);
      name = name.replace(quantityMatch[0], '').trim();
    }
    
    // Parse category (#category)
    const categoryMatch = name.match(/#(\w+)/);
    if (categoryMatch) {
      category = categoryMatch[1];
      name = name.replace(categoryMatch[0], '').trim();
    }
    
    // Parse notes (text in parentheses)
    const notesMatch = name.match(/\(([^)]+)\)/);
    if (notesMatch) {
      notes = notesMatch[1];
      name = name.replace(notesMatch[0], '').trim();
    }
    
    return { name, quantity, category, notes };
  };

  const addItems = async (text: string) => {
    if (!text.trim()) return;

    try {
      const lines = text.split('\n').filter(line => line.trim());
      const maxSortOrder = Math.max(...items.map(item => item.sort_order), -1);
      
      const newItems = lines.map((line, index) => {
        const parsed = parseItemText(line);
        return {
          list_id: list.id,
          name: parsed.name,
          notes: parsed.notes || null,
          quantity: parsed.quantity,
          category: parsed.category || null,
          sort_order: maxSortOrder + index + 1,
          created_by: profile.id
        };
      });

      const { error } = await supabase
        .from('list_items')
        .insert(newItems);

      if (error) throw error;

      setNewItemText('');
      fetchItems();
      
      // Refocus input
      setTimeout(() => {
        newItemInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: 'Error',
        description: 'Failed to add items',
        variant: 'destructive'
      });
    }
  };

  const toggleItemComplete = async (item: ListItem) => {
    try {
      const { error } = await supabase
        .from('list_items')
        .update({
          is_completed: !item.is_completed,
          completed_at: !item.is_completed ? new Date().toISOString() : null,
          completed_by: !item.is_completed ? profile.id : null
        })
        .eq('id', item.id);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error toggling item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive'
      });
    }
  };

  const updateItem = async (itemId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('list_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive'
      });
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive'
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(destIndex, 0, reorderedItem);

    // Update sort orders
    const updates = newItems.map((item, index) => ({
      id: item.id,
      sort_order: index
    }));

    setItems(newItems);

    try {
      for (const update of updates) {
        await supabase
          .from('list_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error reordering items:', error);
      fetchItems(); // Revert on error
    }
  };

  const updateAssignees = async (itemId: string, selectedAssignees: string[]) => {
    try {
      // Remove existing assignments
      await supabase
        .from('list_item_assignees')
        .delete()
        .eq('list_item_id', itemId);

      // Add new assignments
      if (selectedAssignees.length > 0) {
        const assignments = selectedAssignees.map(profileId => ({
          list_item_id: itemId,
          profile_id: profileId,
          assigned_by: profile.id
        }));

        await supabase
          .from('list_item_assignees')
          .insert(assignments);
      }

      fetchItems();
      setAssigningItem(null);
    } catch (error) {
      console.error('Error updating assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to update assignments',
        variant: 'destructive'
      });
    }
  };

  const clearCompleted = async () => {
    try {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('list_id', list.id)
        .eq('is_completed', true);

      if (error) throw error;
      
      toast({
        title: 'Completed items cleared',
        description: 'All completed items have been removed'
      });
      
      fetchItems();
    } catch (error) {
      console.error('Error clearing completed items:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear completed items',
        variant: 'destructive'
      });
    }
  };

  const activeItems = items.filter(item => !item.is_completed);
  const completedItems = items.filter(item => item.is_completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {list.name}
            <Badge variant="outline">{list.list_type}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Quick Add */}
          <div className="mb-4">
            <div className="flex gap-2">
              <Input
                ref={newItemInputRef}
                placeholder="Add item... (Try: x2 Apples #produce (organic))"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItems(newItemText);
                  }
                }}
                className="flex-1"
              />
              <Button 
                onClick={() => addItems(newItemText)}
                disabled={!newItemText.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Shortcuts: x2 for quantity, @name to assign, #category, (notes)
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Active Items */}
            {activeItems.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Items ({activeItems.length})</h3>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="active-items">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {activeItems.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "flex items-center gap-3 p-3 border rounded-lg bg-card",
                                  snapshot.isDragging && "shadow-lg"
                                )}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab text-muted-foreground hover:text-foreground"
                                >
                                  ⋮⋮
                                </div>
                                
                                <Checkbox
                                  checked={item.is_completed}
                                  onCheckedChange={() => toggleItemComplete(item)}
                                />
                                
                                <div className="flex-1 min-w-0">
                                  {editingItem === item.id ? (
                                    <Input
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          updateItem(item.id, { name: editText });
                                          setEditingItem(null);
                                        }
                                        if (e.key === 'Escape') {
                                          setEditingItem(null);
                                        }
                                      }}
                                      onBlur={() => {
                                        updateItem(item.id, { name: editText });
                                        setEditingItem(null);
                                      }}
                                      autoFocus
                                      className="h-8"
                                    />
                                  ) : (
                                    <div
                                      className="cursor-pointer"
                                      onClick={() => {
                                        setEditingItem(item.id);
                                        setEditText(item.name);
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{item.name}</span>
                                        {item.quantity > 1 && (
                                          <Badge variant="outline" className="text-xs">
                                            x{item.quantity}
                                          </Badge>
                                        )}
                                        {item.category && (
                                          <Badge variant="secondary" className="text-xs">
                                            {item.category}
                                          </Badge>
                                        )}
                                      </div>
                                      {item.notes && (
                                        <div className="text-sm text-muted-foreground mt-1">
                                          {item.notes}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Assignees */}
                                {item.assignees && item.assignees.length > 0 && (
                                  <TaskAssigneesDisplay
                                    task={{ assignees: item.assignees } as any}
                                    onClick={() => setAssigningItem(item.id)}
                                    className="mr-2"
                                  />
                                )}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => setAssigningItem(item.id)}
                                    >
                                      <User className="h-4 w-4 mr-2" />
                                      Assign
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => deleteItem(item.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}

            {/* Completed Items */}
            {completedItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="h-8 gap-2"
                  >
                    {showCompleted ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Completed ({completedItems.length})
                  </Button>
                  
                  {showCompleted && completedItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearCompleted}
                      className="text-xs"
                    >
                      Clear Completed
                    </Button>
                  )}
                </div>
                
                {showCompleted && (
                  <div className="space-y-2 opacity-60">
                    {completedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                      >
                        <Checkbox
                          checked={item.is_completed}
                          onCheckedChange={() => toggleItemComplete(item)}
                        />
                        <div className="flex-1 line-through text-muted-foreground">
                          <span>{item.name}</span>
                          {item.quantity > 1 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              x{item.quantity}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItem(item.id)}
                          className="h-8 w-8 p-0 text-muted-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Plus className="mx-auto h-8 w-8 mb-2" />
                <p>No items yet. Add your first item above!</p>
              </div>
            )}
          </div>
        </div>

        {/* Assignment Dialog */}
        {assigningItem && (
          <Dialog open={!!assigningItem} onOpenChange={() => setAssigningItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <MultiSelectAssignees
                  familyMembers={familyMembers as any}
                  selectedAssignees={
                    items
                      .find(item => item.id === assigningItem)
                      ?.assignees?.map(a => a.profile.id) || []
                  }
                  onAssigneesChange={(assignees) => updateAssignees(assigningItem, assignees)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAssigningItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => setAssigningItem(null)}>
                    Done
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}