import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { List, Plus } from 'lucide-react';
import { Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { getMemberColorClasses } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ListItem {
  id: string;
  name: string;
  is_completed: boolean;
  category?: string;
  quantity?: number;
}

interface MemberPersonalListsProps {
  member: Profile;
  profile: Profile;
}

export const MemberPersonalLists = ({
  member,
  profile
}: MemberPersonalListsProps) => {
  const memberColors = getMemberColorClasses(member.color);
  
  // Fetch member's personal list items
  const { data: listItems = [], refetch } = useQuery({
    queryKey: ['member-list-items', member.id],
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
          lists!inner(name, family_id)
        `)
        .eq('lists.family_id', profile.family_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (ListItem & { lists: { name: string } })[];
    }
  });

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

  const incompleteItems = listItems.filter(item => !item.is_completed);
  const completedItems = listItems.filter(item => item.is_completed);

  return (
    <Card className={cn("h-full", memberColors.border)} style={{ borderWidth: '2px' }}>
      <CardHeader className="pb-4">
        <CardTitle className={cn("flex items-center gap-2 text-xl", memberColors.text)}>
          <List className="h-6 w-6" />
          My Lists
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {listItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No list items found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Incomplete Items */}
            {incompleteItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">To Do</h4>
                {incompleteItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg border">
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

            {/* Completed Items */}
            {completedItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Completed</h4>
                {completedItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center space-x-3 p-2 rounded-lg border opacity-60">
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
                {completedItems.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    And {completedItems.length - 3} more completed items...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};