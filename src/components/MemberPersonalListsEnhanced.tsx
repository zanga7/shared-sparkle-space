import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AddButton } from '@/components/ui/add-button';
import { List, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { useMemberColor } from '@/hooks/useMemberColor';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ListItem {
  id: string;
  name: string;
  is_completed: boolean;
  category?: string;
  quantity?: number;
  list_id: string;
  lists: { name: string };
}

interface MemberPersonalListsEnhancedProps {
  member: Profile;
  profile: Profile;
  memberColor?: string;
}

export const MemberPersonalListsEnhanced = ({
  member,
  profile,
  memberColor
}: MemberPersonalListsEnhancedProps) => {
  const { styles: colorStyles } = useMemberColor(memberColor || member.color);
  const { toast } = useToast();
  const [newItemName, setNewItemName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  // Fetch member's personal list items and assigned items
  const { data: allListItems = [], refetch } = useQuery({
    queryKey: ['member-all-list-items', member.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id,
          name,
          is_completed,
          category,
          quantity,
          list_id,
          created_by,
          lists!inner(name, family_id),
          assignees:list_item_assignees(
            profile_id,
            profile:profiles(id, display_name, color)
          )
        `)
        .eq('lists.family_id', profile.family_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (ListItem & { 
        created_by: string; 
        assignees: Array<{ profile_id: string; profile: { id: string; display_name: string; color: string } }>;
      })[];
    }
  });

  // Separate personal items from assigned items
  const personalListItems = allListItems.filter(item => 
    item.lists.name === `${member.display_name}'s Personal List`
  );
  
  const assignedListItems = allListItems.filter(item => 
    item.lists.name !== `${member.display_name}'s Personal List` &&
    item.assignees?.some(assignee => assignee.profile_id === member.id)
  );

  const toggleComplete = async (itemId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from('list_items')
      .update({ 
        is_completed: !isCompleted,
        completed_at: !isCompleted ? new Date().toISOString() : null,
        completed_by: !isCompleted ? member.id : null
      })
      .eq('id', itemId);
    
    if (!error) {
      refetch();
    }
  };

  const addNewItem = async () => {
    if (!newItemName.trim()) return;

    // First, get or create a personal list for this member
    let { data: personalList } = await supabase
      .from('lists')
      .select('id')
      .eq('family_id', profile.family_id)
      .eq('name', `${member.display_name}'s Personal List`)
      .single();

    if (!personalList) {
      const { data: newList, error: listError } = await supabase
        .from('lists')
        .insert({
          name: `${member.display_name}'s Personal List`,
          family_id: profile.family_id,
          created_by: profile.id
        })
        .select('id')
        .single();

      if (listError) {
        toast({
          title: 'Error',
          description: 'Failed to create personal list',
          variant: 'destructive'
        });
        return;
      }
      personalList = newList;
    }

    const { error } = await supabase
      .from('list_items')
      .insert({
        name: newItemName.trim(),
        list_id: personalList.id,
        created_by: member.id
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add item',
        variant: 'destructive'
      });
    } else {
      setNewItemName('');
      setIsAddingItem(false);
      refetch();
      toast({
        title: 'Success',
        description: 'Item added to your personal list'
      });
    }
  };

  const editItem = async (itemId: string, newName: string) => {
    if (!newName.trim()) return;

    const { error } = await supabase
      .from('list_items')
      .update({ name: newName.trim() })
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive'
      });
    } else {
      setEditingItemId(null);
      setEditingName('');
      refetch();
    }
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive'
      });
    } else {
      refetch();
      toast({
        title: 'Success',
        description: 'Item deleted'
      });
    }
  };

  const incompletePersonalItems = personalListItems.filter(item => !item.is_completed);
  const completedPersonalItems = personalListItems.filter(item => item.is_completed);
  const incompleteAssignedItems = assignedListItems.filter(item => !item.is_completed);
  const completedAssignedItems = assignedListItems.filter(item => item.is_completed);

  return (
    <Card className="h-full flex flex-col" style={colorStyles.bg10}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl" style={colorStyles.text}>
          <List className="h-6 w-6" />
          My Lists
        </CardTitle>
        
        {/* Add Item Section */}
        {isAddingItem ? (
          <div className="flex gap-2">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Enter item name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNewItem();
                if (e.key === 'Escape') setIsAddingItem(false);
              }}
              autoFocus
            />
            <Button size="sm" onClick={addNewItem}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsAddingItem(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <AddButton 
            text="Add Item"
            onClick={() => setIsAddingItem(true)}
            className="border-dashed hover:border-solid w-full"
            style={{ ...colorStyles.border, ...colorStyles.text }}
          />
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto component-spacing p-0 pt-4">
        {/* Personal List Section */}
        <div className="component-spacing px-3">
          <h3 className="font-semibold text-base text-foreground border-b pb-2">My Personal Items</h3>
          {personalListItems.length === 0 && !isAddingItem ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No personal items yet</p>
            </div>
          ) : (
            <>
              {/* Incomplete Personal Items */}
              {incompletePersonalItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">To Do</h4>
                  {incompletePersonalItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg border group">
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={() => toggleComplete(item.id, item.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        {editingItemId === item.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') editItem(item.id, editingName);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={() => editItem(item.id, editingName)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItemId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{item.name}</span>
                              {item.quantity && item.quantity > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.quantity}
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {editingItemId !== item.id && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingName(item.name);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Personal Items */}
              {completedPersonalItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Completed</h4>
                  {completedPersonalItems.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg border opacity-60 group">
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={() => toggleComplete(item.id, item.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium line-through">{item.name}</span>
                          {item.quantity && item.quantity > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {item.quantity}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {completedPersonalItems.length > 2 && (
                    <p className="text-sm text-muted-foreground text-center py-1">
                      +{completedPersonalItems.length - 2} more completed
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Assigned Items Section */}
        <div className="component-spacing px-3">
          <h3 className="font-semibold text-base text-foreground border-b pb-2">Assigned to Me</h3>
          {assignedListItems.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No items assigned to you</p>
            </div>
          ) : (
            <>
              {/* Incomplete Assigned Items */}
              {incompleteAssignedItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">To Do</h4>
                  {incompleteAssignedItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg border group">
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={() => toggleComplete(item.id, item.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.name}</span>
                          {item.quantity && item.quantity > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {item.quantity}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.lists.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Assigned Items */}
              {completedAssignedItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Completed</h4>
                  {completedAssignedItems.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg border opacity-60 group">
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={() => toggleComplete(item.id, item.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium line-through">{item.name}</span>
                          {item.quantity && item.quantity > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {item.quantity}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.lists.name}</p>
                      </div>
                    </div>
                  ))}
                  {completedAssignedItems.length > 2 && (
                    <p className="text-sm text-muted-foreground text-center py-1">
                      +{completedAssignedItems.length - 2} more completed
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};