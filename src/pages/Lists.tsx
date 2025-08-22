import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Tent, 
  List as ListIcon, 
  Archive,
  Calendar,
  Users,
  MoreVertical,
  Hash
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ListDetailDialog } from '@/components/lists/ListDetailDialog';
import { CreateListDialog } from '@/components/lists/CreateListDialog';
import { EditListDialog } from '@/components/lists/EditListDialog';
import { CategoryManager } from '@/components/lists/CategoryManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface List {
  id: string;
  name: string;
  description?: string;
  list_type: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  items_count?: number;
  completed_count?: number;
  assignees_count?: number;
}

interface Profile {
  id: string;
  user_id: string;
  family_id: string;
  display_name: string;
  role: 'parent' | 'child';
}

const Lists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<List | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchLists();
    }
  }, [profile]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive'
      });
    }
  };

  const fetchLists = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      // Fetch lists with item counts
      const { data: listsData, error } = await supabase
        .from('lists')
        .select(`
          *,
          list_items(
            id,
            is_completed,
            list_item_assignees(profile_id)
          )
        `)
        .eq('family_id', profile.family_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Process lists to include counts
      const processedLists = listsData?.map(list => {
        const items = list.list_items || [];
        const assigneeIds = new Set();
        
        items.forEach((item: any) => {
          item.list_item_assignees?.forEach((assignee: any) => {
            assigneeIds.add(assignee.profile_id);
          });
        });

        return {
          ...list,
          items_count: items.length,
          completed_count: items.filter((item: any) => item.is_completed).length,
          assignees_count: assigneeIds.size,
          list_items: undefined // Remove the nested data to clean up
        };
      }) || [];

      setLists(processedLists);
    } catch (error) {
      console.error('Error fetching lists:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lists',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLists = lists.filter(list => {
    // Apply search filter
    if (searchQuery && !list.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Apply type filter
    switch (selectedFilter) {
      case 'shopping':
        return list.list_type === 'shopping';
      case 'camping':
        return list.list_type === 'camping';
      case 'custom':
        return list.list_type === 'custom';
      case 'archived':
        return list.is_archived;
      case 'all':
      default:
        return !list.is_archived;
    }
  });

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

  const handleListCreated = () => {
    fetchLists();
    setIsCreateDialogOpen(false);
  };

  const handleListUpdated = () => {
    fetchLists();
    setSelectedList(null);
  };

  const duplicateList = async (list: List) => {
    if (!profile) return;

    try {
      // Create new list
      const { data: newList, error: listError } = await supabase
        .from('lists')
        .insert({
          family_id: profile.family_id,
          name: `${list.name} (Copy)`,
          description: list.description,
          list_type: list.list_type,
          created_by: profile.id
        })
        .select()
        .single();

      if (listError) throw listError;

      // Copy items
      const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', list.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        const newItems = items.map(item => ({
          list_id: newList.id,
          name: item.name,
          notes: item.notes,
          quantity: item.quantity,
          category: item.category,
          due_date: item.due_date,
          sort_order: item.sort_order,
          created_by: profile.id
        }));

        const { error: insertError } = await supabase
          .from('list_items')
          .insert(newItems);

        if (insertError) throw insertError;
      }

      toast({
        title: 'List duplicated',
        description: 'List has been successfully duplicated'
      });

      fetchLists();
    } catch (error) {
      console.error('Error duplicating list:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate list',
        variant: 'destructive'
      });
    }
  };

  const archiveList = async (list: List) => {
    try {
      const { error } = await supabase
        .from('lists')
        .update({ is_archived: !list.is_archived })
        .eq('id', list.id);

      if (error) throw error;

      toast({
        title: list.is_archived ? 'List restored' : 'List archived',
        description: `List has been ${list.is_archived ? 'restored' : 'archived'} successfully`
      });

      fetchLists();
    } catch (error) {
      console.error('Error archiving list:', error);
      toast({
        title: 'Error',
        description: 'Failed to update list',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg">Loading your lists...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Lists</h1>
            <p className="text-muted-foreground">Manage your family shopping, camping, and to-do lists</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsCategoryManagerOpen(true)} 
              className="gap-2"
            >
              <Hash className="h-4 w-4" />
              Manage Categories
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New List
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedFilter} onValueChange={setSelectedFilter} className="mb-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="shopping">Shopping</TabsTrigger>
            <TabsTrigger value="camping">Camping</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLists.map((list) => (
            <Card 
              key={list.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedList(list)}
            >
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
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditingList(list);
                        }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          duplicateList(list);
                        }}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          archiveList(list);
                        }}>
                          {list.is_archived ? 'Restore' : 'Archive'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {list.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{list.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <ListIcon className="h-3 w-3" />
                      {list.items_count || 0} items
                    </span>
                    {(list.assignees_count || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {list.assignees_count} assigned
                      </span>
                    )}
                  </div>
                </div>
                
                {(list.items_count || 0) > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{list.completed_count || 0} of {list.items_count || 0} done</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ 
                          width: `${list.items_count ? ((list.completed_count || 0) / list.items_count) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  Updated {format(new Date(list.updated_at), 'MMM d, yyyy')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredLists.length === 0 && (
          <div className="text-center py-12">
            <ListIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No lists found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? "No lists match your search criteria"
                : "Create your first list to get organized"
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create List
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {selectedList && (
        <ListDetailDialog
          list={selectedList}
          open={!!selectedList}
          onOpenChange={() => setSelectedList(null)}
          onListUpdated={handleListUpdated}
          profile={profile!}
        />
      )}

      <CreateListDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onListCreated={handleListCreated}
        profile={profile!}
      />

      {editingList && (
        <EditListDialog
          list={editingList}
          open={!!editingList}
          onOpenChange={() => setEditingList(null)}
          onListUpdated={() => {
            fetchLists();
            setEditingList(null);
          }}
        />
      )}

      {profile && (
        <CategoryManager
          open={isCategoryManagerOpen}
          onOpenChange={setIsCategoryManagerOpen}
          familyId={profile.family_id}
        />
      )}
    </div>
  );
};

export default Lists;