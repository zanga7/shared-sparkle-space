import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  Hash
} from 'lucide-react';
import { CompactInlineListCard } from '@/components/lists/CompactInlineListCard';
import { CreateListDialog } from '@/components/lists/CreateListDialog';
import { EditListDialog } from '@/components/lists/EditListDialog';
import { CategoryManager } from '@/components/lists/CategoryManager';

interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
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

interface Profile {
  id: string;
  user_id: string;
  family_id: string;
  display_name: string;
  role: 'parent' | 'child';
  color: string;
  total_points: number;
}

const Lists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
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
      fetchCategories();
      fetchProfiles();
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
      
      // Ensure required fields have defaults
      const profileData = {
        ...data,
        color: data.color || 'sky',
        total_points: data.total_points || 0
      };
      
      setProfile(profileData);
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
      
      // Fetch lists with item counts and category info
      const { data: listsData, error } = await supabase
        .from('lists')
        .select(`
          *,
          category:categories(id, name, color, icon),
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

  const fetchCategories = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_id', profile.family_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProfiles = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const isPersonalList = (list: List): boolean => {
    return profiles.some(p => 
      list.name === `${p.display_name}'s Personal List`
    );
  };

  const filteredLists = lists.filter(list => {
    // Apply search filter
    if (searchQuery && !list.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Apply category filter
    if (selectedFilter === 'archived') {
      return list.is_archived;
    } else if (selectedFilter === 'personal') {
      return !list.is_archived && isPersonalList(list);
    } else if (selectedFilter === 'all') {
      return !list.is_archived && !isPersonalList(list);
    } else {
      // Filter by category ID (exclude personal lists)
      return !list.is_archived && list.category_id === selectedFilter && !isPersonalList(list);
    }
  });

  const handleListCreated = (newList: List) => {
    // Add new list to state without refetching
    setLists(prev => [newList, ...prev]);
    setIsCreateDialogOpen(false);
  };

  const handleListUpdated = (updatedList: List) => {
    // Update specific list in state without refetching
    setLists(prev => prev.map(list => 
      list.id === updatedList.id ? updatedList : list
    ));
  };

  const handleListItemsUpdated = (listId: string, itemsCount: number, completedCount: number, assigneesCount: number) => {
    // Update list counts without refetching
    setLists(prev => prev.map(list => 
      list.id === listId 
        ? { ...list, items_count: itemsCount, completed_count: completedCount, assignees_count: assigneesCount }
        : list
    ));
  };

  const handleCategoryUpdated = () => {
    fetchCategories();
    // Only refetch lists if we need category info updated
    fetchLists();
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
          category_id: list.category_id,
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

      // Add duplicated list to state without refetching
      const duplicatedList = {
        ...newList,
        items_count: items?.length || 0,
        completed_count: 0,
        assignees_count: 0
      };
      setLists(prev => [duplicatedList, ...prev]);
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
    // Prevent archiving personal lists
    if (isPersonalList(list)) {
      toast({
        title: 'Cannot archive',
        description: 'Personal lists cannot be archived',
        variant: 'destructive'
      });
      return;
    }

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

      // Update list in state without refetching
      setLists(prev => prev.map(l => 
        l.id === list.id ? { ...l, is_archived: !l.is_archived } : l
      ));
    } catch (error) {
      console.error('Error archiving list:', error);
      toast({
        title: 'Error',
        description: 'Failed to update list',
        variant: 'destructive'
      });
    }
  };

  const deleteList = async (list: List) => {
    // Prevent deleting personal lists
    if (isPersonalList(list)) {
      toast({
        title: 'Cannot delete',
        description: 'Personal lists cannot be deleted',
        variant: 'destructive'
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${list.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', list.id);

      if (error) throw error;

      toast({
        title: 'List deleted',
        description: 'List has been permanently deleted'
      });

      // Remove list from state without refetching
      setLists(prev => prev.filter(l => l.id !== list.id));
    } catch (error) {
      console.error('Error deleting list:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete list',
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
    <div className="min-h-screen bg-background page-padding">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between section-spacing">
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
          <div className="flex flex-col sm:flex-row gap-4 section-spacing">
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
          <Tabs value={selectedFilter} onValueChange={setSelectedFilter} className="section-spacing">
            <TabsList className="grid w-full h-auto" style={{ gridTemplateColumns: `repeat(${categories.length + 3}, 1fr)` }}>
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="flex-1">
                  {category.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="personal" className="flex-1">Personal</TabsTrigger>
              <TabsTrigger value="archived" className="flex-1">Archived</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Lists Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-gap">
            {filteredLists.map((list) => (
              <CompactInlineListCard
                key={list.id}
                list={list}
                profile={profile!}
                isPersonalList={isPersonalList(list)}
                onEditList={setEditingList}
                onDuplicateList={duplicateList}
                onArchiveList={archiveList}
                onDeleteList={deleteList}
                onListUpdated={handleListUpdated}
                onListItemsUpdated={handleListItemsUpdated}
              />
            ))}
          </div>

          {filteredLists.length === 0 && (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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
            onOpenChange={(open) => !open && setEditingList(null)}
            onListUpdated={handleListUpdated}
          />
        )}

      <CategoryManager
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        familyId={profile?.family_id || ''}
        onCategoryUpdated={handleCategoryUpdated}
      />
    </div>
  );
};

export default Lists;