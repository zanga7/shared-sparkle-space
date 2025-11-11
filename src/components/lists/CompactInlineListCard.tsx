import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Edit, 
  Users,
  ChevronDown,
  ChevronUp,
  Settings,
  Copy,
  Archive,
  ArchiveRestore,
  ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { EnhancedListInput } from '@/components/ui/enhanced-list-input';

interface Profile {
  id: string;
  family_id: string;
  display_name: string;
  role: 'parent' | 'child';
  color: string;
  total_points: number;
}

interface ListItem {
  id: string;
  name: string;
  notes?: string;
  quantity: number;
  category?: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  sort_order: number;
  assignees?: {
    id: string;
    display_name: string;
    color: string;
  }[];
}

interface List {
  id: string;
  name: string;
  description?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  family_id: string;
  category_id?: string;
  items_count?: number;
  completed_count?: number;
  assignees_count?: number;
}

interface CompactInlineListCardProps {
  list: List;
  profile: Profile;
  isPersonalList: boolean;
  onEditList: (list: List) => void;
  onDuplicateList: (list: List) => void;
  onArchiveList: (list: List) => void;
  onDeleteList: (list: List) => void;
  onListUpdated: (updatedList: List) => void;
  onListItemsUpdated: (listId: string, itemsCount: number, completedCount: number, assigneesCount: number) => void;
}

export function CompactInlineListCard({ 
  list, 
  profile, 
  isPersonalList,
  onEditList,
  onDuplicateList,
  onArchiveList,
  onDeleteList,
  onListUpdated,
  onListItemsUpdated
}: CompactInlineListCardProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ListItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningItem, setAssigningItem] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
    fetchFamilyMembers();
  }, [list.id]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          *,
          assignees:list_item_assignees(
            profile:profiles(id, display_name, color)
          )
        `)
        .eq('list_id', list.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      const processedItems = (data || []).map(item => ({
        ...item,
        assignees: item.assignees?.map((a: any) => a.profile) || []
      }));
      
      setItems(processedItems as ListItem[]);
    } catch (error) {
      console.error('Error fetching items:', error);
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
      setFamilyMembers((data || []).map(member => ({
        ...member,
        color: member.color || 'sky',
        total_points: member.total_points || 0
      })) as Profile[]);
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
      setAdding(true);
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

      const { data, error } = await supabase
        .from('list_items')
        .insert(newItems)
        .select('*');

      if (error) throw error;

      // Update items state directly (AJAX approach)
      if (data) {
        const newItemsWithAssignees = data.map(item => ({
          ...item,
          assignees: [] as any[]
        }));
        setItems(prev => [...prev, ...newItemsWithAssignees]);
      }

      setNewItemText('');
      
      // Update parent counts
      const newItemsCount = items.length + (data?.length || 0);
      const completedCount = items.filter(item => item.is_completed).length;
      const assigneeIds = new Set();
      items.forEach(item => {
        item.assignees?.forEach((assignee: any) => {
          assigneeIds.add(assignee.id);
        });
      });
      onListItemsUpdated(list.id, newItemsCount, completedCount, assigneeIds.size);
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: 'Error',
        description: 'Failed to add items',
        variant: 'destructive'
      });
    } finally {
      setAdding(false);
    }
  };

  const toggleItemComplete = async (itemId: string, newCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('list_items')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          completed_by: newCompleted ? profile.id : null
        })
        .eq('id', itemId);

      if (error) throw error;
      
      // Update items state directly (AJAX approach)
      setItems(prev => prev.map(item => 
        item.id === itemId 
          ? {
              ...item,
              is_completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
              completed_by: newCompleted ? profile.id : null
            }
          : item
      ));
      
      // Update parent counts
      const completedCount = items.filter(item => 
        item.id === itemId ? newCompleted : item.is_completed
      ).length;
      onListItemsUpdated(list.id, items.length, completedCount, 0); // assignees count unchanged
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
      
      // Update items state directly (AJAX approach)
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
      
      // Update parent counts if needed (item names don't affect counts)
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
      
      // Update items state directly (AJAX approach)
      const itemToDelete = items.find(item => item.id === itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      
      // Update parent counts
      const newItemsCount = items.length - 1;
      const completedCount = items.filter(item => 
        item.id !== itemId && item.is_completed
      ).length;
      const assigneeIds = new Set();
      items.filter(item => item.id !== itemId).forEach(item => {
        item.assignees?.forEach((assignee: any) => {
          assigneeIds.add(assignee.id);
        });
      });
      onListItemsUpdated(list.id, newItemsCount, completedCount, assigneeIds.size);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive'
      });
    }
  };

  const handleSaveEdit = async () => {
    if (editingItem && editingValue.trim()) {
      await updateItem(editingItem, { name: editingValue.trim() });
    }
    setEditingItem(null);
    setEditingValue('');
  };

  const completedCount = items.filter(item => item.is_completed).length;
  const progressPercentage = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <ListTodo className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg truncate">{list.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditList(list)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicateList(list)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                {!isPersonalList && (
                  <>
                    <DropdownMenuItem onClick={() => onArchiveList(list)}>
                      {list.is_archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDeleteList(list)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {list.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{list.description}</p>
        )}
      </CardHeader>

      <CardContent className="pt-0 pb-3">
        {/* Items list */}
        <div className="space-y-1 mb-3">
          {items.slice(0, isExpanded ? items.length : 10).map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-1 group hover:bg-muted/50 rounded-sm px-1 -mx-1">
              <Checkbox 
                id={`item-${item.id}`}
                checked={item.is_completed}
                onCheckedChange={() => toggleItemComplete(item.id, !item.is_completed)}
                className="flex-shrink-0 h-4 w-4"
              />
              <div className="flex-1 min-w-0">
                {editingItem === item.id ? (
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') {
                        setEditingItem(null);
                        setEditingValue('');
                      }
                    }}
                    className="h-7 text-sm border-none px-1 focus:ring-1"
                    autoFocus
                  />
                ) : (
                  <span
                    className={cn(
                      "text-sm cursor-pointer block truncate py-1 px-1 rounded hover:bg-accent/50",
                      item.is_completed ? "line-through text-muted-foreground" : ""
                    )}
                    onClick={() => {
                      setEditingItem(item.id);
                      setEditingValue(item.name);
                    }}
                  >
                    {item.quantity && item.quantity > 1 && (
                      <span className="font-medium mr-1 text-xs">({item.quantity})</span>
                    )}
                    {item.name}
                    {item.category && (
                      <span className="text-xs text-muted-foreground ml-1">
                        [{item.category}]
                      </span>
                    )}
                  </span>
                )}
              </div>
              
              {item.assignees && item.assignees.length > 0 && (
                <div className="flex -space-x-1">
                  {item.assignees.slice(0, 2).map((assignee, index) => (
                    <UserAvatar
                      key={assignee.id}
                      name={assignee.display_name}
                      color={assignee.color}
                      size="sm"
                      className="border border-background h-5 w-5 text-xs"
                    />
                  ))}
                  {item.assignees.length > 2 && (
                    <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        +{item.assignees.length - 2}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setEditingItem(item.id);
                    setEditingValue(item.name);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      setAssigningItem(item.id);
                      setShowAssignDialog(true);
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
          ))}
        </div>

        {/* Quick add input */}
        <div className="border-t pt-2">
          <EnhancedListInput
            value={newItemText}
            onChange={setNewItemText}
            onAddItems={addItems}
            placeholder="Add an item..."
            disabled={adding}
            existingItems={items.map(item => item.name)}
            preventDuplicates={true}
            
            className="mb-0"
          />
        </div>

        {/* Show/Hide button */}
        {items.length > 10 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-2 h-7 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {items.length - 10} More
              </>
            )}
          </Button>
        )}

        {/* Progress indicator */}
        {items.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} of {items.length} complete</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-1" />
          </div>
        )}
      </CardContent>

      {/* Assignment Dialog */}
      {showAssignDialog && assigningItem && (
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Assign "{items.find(i => i.id === assigningItem)?.name}" to:
              </div>
              <MultiSelectAssignees
                familyMembers={familyMembers}
                selectedAssignees={items.find(i => i.id === assigningItem)?.assignees?.map(a => a.id) || []}
                onAssigneesChange={async (selectedAssignees) => {
                  try {
                    // Remove existing assignments
                    await supabase
                      .from('list_item_assignees')
                      .delete()
                      .eq('list_item_id', assigningItem);

                    // Add new assignments
                    if (selectedAssignees.length > 0) {
                      const assignments = selectedAssignees.map(profileId => ({
                        list_item_id: assigningItem,
                        profile_id: profileId,
                        assigned_by: profile.id
                      }));

                      await supabase
                        .from('list_item_assignees')
                        .insert(assignments);
                    }

                    // Update local state (AJAX approach)
                    setItems(prev => prev.map(item => 
                      item.id === assigningItem 
                        ? {
                            ...item,
                            assignees: selectedAssignees.map(id => {
                              const member = familyMembers.find(m => m.id === id);
                              return {
                                id: member?.id || '',
                                display_name: member?.display_name || '',
                                color: member?.color || 'sky'
                              };
                            })
                          }
                        : item
                    ));

                    setShowAssignDialog(false);
                    setAssigningItem(null);
                    // Don't trigger parent update for assignee changes
                  } catch (error) {
                    console.error('Error updating assignments:', error);
                    toast({
                      title: 'Error',
                      description: 'Failed to update assignments',
                      variant: 'destructive'
                    });
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}