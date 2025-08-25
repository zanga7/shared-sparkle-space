import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { UserAvatar } from '@/components/ui/user-avatar';
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
  ChevronRight,
  ChevronUp,
  Settings,
  ShoppingCart,
  Tent,
  List as ListIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  created_at: string;
  updated_at: string;
  created_by: string;
  family_id: string;
  category_id?: string;
  items_count?: number;
  completed_count?: number;
  assignees_count?: number;
}

interface InlineListCardProps {
  list: List;
  profile: Profile;
  onEditList: (list: List) => void;
  onDuplicateList: (list: List) => void;
  onArchiveList: (list: List) => void;
  onDeleteList: (list: List) => void;
  onListUpdated: () => void;
}

export function InlineListCard({ 
  list, 
  profile, 
  onEditList,
  onDuplicateList,
  onArchiveList,
  onDeleteList,
  onListUpdated
}: InlineListCardProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ListItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [assigningItem, setAssigningItem] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const newItemInputRef = useRef<HTMLInputElement>(null);

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
      await fetchItems();
      onListUpdated();
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
      await fetchItems();
      onListUpdated();
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
      await fetchItems();
      onListUpdated();
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
      await fetchItems();
      onListUpdated();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive'
      });
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

      await fetchItems();
      setAssigningItem(null);
      onListUpdated();
    } catch (error) {
      console.error('Error updating assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to update assignments',
        variant: 'destructive'
      });
    }
  };

  const getListIcon = (type: string) => {
    switch (type) {
      case 'shopping':
        return <ShoppingCart className="h-4 w-4" />;
      case 'camping':
        return <Tent className="h-4 w-4" />;
      default:
        return <ListIcon className="h-4 w-4" />;
    }
  };

  const getListTypeColor = (type: string) => {
    switch (type) {
      case 'shopping':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'camping':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  const activeItems = items.filter(item => !item.is_completed);
  const completedItems = items.filter(item => item.is_completed);
  const displayItems = expanded ? items : activeItems.slice(0, 3);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            {getListIcon(list.list_type)}
            <CardTitle className="text-lg truncate">{list.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("text-xs", getListTypeColor(list.list_type))}
            >
              {list.list_type}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditList(list)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicateList(list)}>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchiveList(list)}>
                  {list.is_archived ? 'Restore' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDeleteList(list)}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {list.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{list.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Quick Add */}
        <div className="flex gap-2">
          <Input
            ref={newItemInputRef}
            placeholder="Add item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItems(newItemText);
              }
            }}
            className="flex-1 h-8"
          />
          <Button 
            onClick={() => addItems(newItemText)}
            disabled={!newItemText.trim()}
            size="sm"
            className="h-8 px-2"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 border rounded-md bg-card/50"
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={() => toggleItemComplete(item)}
                className="h-4 w-4"
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
                    className="h-6 text-sm"
                  />
                ) : (
                  <div
                    className={cn(
                      "cursor-pointer text-sm",
                      item.is_completed && "line-through text-muted-foreground"
                    )}
                    onClick={() => {
                      setEditingItem(item.id);
                      setEditText(item.name);
                    }}
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{item.name}</span>
                      {item.quantity > 1 && (
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          x{item.quantity}
                        </Badge>
                      )}
                      {item.category && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {item.assignees && item.assignees.length > 0 && (
                <div className="flex -space-x-1">
                  {item.assignees.slice(0, 2).map((assignee) => (
                    <UserAvatar
                      key={assignee.profile.id}
                      name={assignee.profile.display_name}
                      color={assignee.profile.color}
                      size="sm"
                      className="border border-background"
                    />
                  ))}
                  {item.assignees.length > 2 && (
                    <UserAvatar
                      name={`+${item.assignees.length - 2}`}
                      size="sm"
                      className="border border-background bg-muted text-muted-foreground"
                    />
                  )}
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setAssigningItem(item.id)}>
                    <User className="h-3 w-3 mr-2" />
                    Assign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteItem(item.id)} className="text-destructive">
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Expand/Collapse */}
          {(activeItems.length > 3 || completedItems.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full h-8 text-xs"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show {activeItems.length > 3 ? `${activeItems.length - 3} more` : ''}
                  {completedItems.length > 0 && ` + ${completedItems.length} completed`}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        {items.length > 0 && (
          <div className="pt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{completedItems.length} of {items.length} done</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-primary rounded-full h-1.5 transition-all"
                style={{ 
                  width: `${items.length ? (completedItems.length / items.length) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        )}

        {/* Assignment Dialog */}
        {assigningItem && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-lg p-4 max-w-sm w-full">
              <h3 className="font-medium mb-3">Assign to</h3>
              <MultiSelectAssignees
                familyMembers={familyMembers}
                selectedAssignees={
                  items.find(item => item.id === assigningItem)?.assignees?.map(a => a.profile.id) || []
                }
                onAssigneesChange={(assignees) => updateAssignees(assigningItem, assignees)}
              />
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => setAssigningItem(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}