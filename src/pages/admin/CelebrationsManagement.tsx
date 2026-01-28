import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCelebrations } from '@/hooks/useCelebrations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeading, SmallText } from '@/components/ui/typography';
import { AddCelebrationDialog } from '@/components/celebrations/AddCelebrationDialog';
import { EditCelebrationDialog } from '@/components/celebrations/EditCelebrationDialog';
import { CelebrationCard } from '@/components/celebrations/CelebrationCard';
import { PublicHolidaySettings } from '@/components/admin/PublicHolidaySettings';
import { Plus, Search, Loader2, Trash2, Edit, PartyPopper, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Celebration } from '@/types/celebration';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CelebrationsManagement() {
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCelebration, setEditingCelebration] = useState<Celebration | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: celebrations, isLoading } = useCelebrations(profile?.family_id);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('celebrations' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['celebrations'] });
      toast.success('Celebration deleted successfully');
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error('Failed to delete celebration: ' + error.message);
    },
  });

  const filteredCelebrations = celebrations?.filter((celebration) =>
    celebration.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by month
  const groupedByMonth = filteredCelebrations?.reduce((acc, celebration) => {
    const date = new Date(celebration.celebration_date);
    const month = format(date, 'MMMM');
    if (!acc[month]) acc[month] = [];
    acc[month].push(celebration);
    return acc;
  }, {} as Record<string, typeof celebrations>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-padding component-spacing">
      <div className="flex items-center justify-between section-spacing">
        <div>
          <PageHeading>Celebrations & Holidays</PageHeading>
          <SmallText>
            Manage birthdays, anniversaries, and public holidays
          </SmallText>
        </div>
      </div>

      <Tabs defaultValue="celebrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="celebrations" className="gap-2">
            <PartyPopper className="h-4 w-4" />
            Celebrations
          </TabsTrigger>
          <TabsTrigger value="holidays" className="gap-2">
            <Calendar className="h-4 w-4" />
            Public Holidays
          </TabsTrigger>
        </TabsList>

        <TabsContent value="celebrations" className="space-y-4">
          <Card>
            <CardHeader className="grid-card-header">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search celebrations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Celebration
                </Button>
              </div>
            </CardHeader>

            <CardContent className="grid-card-content">
          {!filteredCelebrations || filteredCelebrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? 'No celebrations found' : 'No celebrations added yet'}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByMonth || {}).map(([month, monthCelebrations]) => (
                <div key={month}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{month}</h2>
                  <div className="space-y-2">
                    {monthCelebrations.map((celebration) => (
                      <div key={celebration.id} className="flex items-center gap-2">
                        <div className="flex-1">
                          <CelebrationCard celebration={celebration} />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCelebration(celebration)}
                          className="gap-1 flex-shrink-0"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(celebration.id)}
                          className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          {profile && <PublicHolidaySettings familyId={profile.family_id} />}
        </TabsContent>
      </Tabs>

      {profile && (
        <>
          <AddCelebrationDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            familyId={profile.family_id}
            profileId={profile.id}
          />

          {editingCelebration && (
            <EditCelebrationDialog
              open={!!editingCelebration}
              onOpenChange={(open) => !open && setEditingCelebration(null)}
              celebration={editingCelebration}
              familyId={profile.family_id}
            />
          )}
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Celebration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this celebration? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
