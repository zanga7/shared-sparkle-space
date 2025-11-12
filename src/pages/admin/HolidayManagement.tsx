import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AddHolidayDialog } from '@/components/admin/AddHolidayDialog';
import { EditHolidayDialog } from '@/components/admin/EditHolidayDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface HolidayDate {
  id: string;
  family_id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function HolidayManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayDate | null>(null);

  // Fetch current user's family
  const { data: profile } = useQuery({
    queryKey: ['current-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch holiday dates
  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holiday-dates', profile?.family_id],
    queryFn: async () => {
      if (!profile?.family_id) return [];

      const { data, error } = await supabase
        .from('holiday_dates')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data as HolidayDate[];
    },
    enabled: !!profile?.family_id,
  });

  // Delete holiday mutation
  const deleteMutation = useMutation({
    mutationFn: async (holidayId: string) => {
      const { error } = await supabase
        .from('holiday_dates')
        .delete()
        .eq('id', holidayId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-dates'] });
      toast({
        title: 'Success',
        description: 'Holiday date deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete holiday: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = async (holiday: HolidayDate) => {
    if (window.confirm(`Are you sure you want to delete "${holiday.name}"?`)) {
      deleteMutation.mutate(holiday.id);
    }
  };

  const handleEdit = (holiday: HolidayDate) => {
    setSelectedHoliday(holiday);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Holiday Management</h1>
          <p className="text-muted-foreground">
            Manage school holidays and breaks for task scheduling
          </p>
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Holiday Management</h1>
          <p className="text-muted-foreground">
            Manage school holidays and breaks. Tasks with "Pause during holidays" will be paused during these dates.
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      {holidays && holidays.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No holidays defined</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add school holidays and breaks to automatically pause recurring tasks during these periods.
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Holiday
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {holidays?.map((holiday) => (
            <Card key={holiday.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      {holiday.name}
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(holiday.start_date), 'MMM d, yyyy')} - {format(new Date(holiday.end_date), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(holiday)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(holiday)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <AddHolidayDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        familyId={profile?.family_id || ''}
        profileId={profile?.id || ''}
      />

      {selectedHoliday && (
        <EditHolidayDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          holiday={selectedHoliday}
        />
      )}
    </div>
  );
}
