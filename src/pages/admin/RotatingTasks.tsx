import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeading, SmallText } from "@/components/ui/typography";
import { Plus, Play, Pause, Settings, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddRotatingTaskDialog } from "@/components/admin/AddRotatingTaskDialog";
import { EditRotatingTaskDialog } from "@/components/admin/EditRotatingTaskDialog";

interface RotatingTask {
  id: string;
  name: string;
  description: string | null;
  points: number;
  cadence: 'daily' | 'weekly' | 'monthly';
  weekly_days: number[] | null;
  monthly_day: number | null;
  member_order: string[];
  current_member_index: number;
  is_active: boolean;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
}

export default function RotatingTasks() {
  const [selectedTask, setSelectedTask] = useState<RotatingTask | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: rotatingTasks, isLoading, refetch } = useQuery({
    queryKey: ['rotating-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rotating_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RotatingTask[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['family-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, color')
        .order('display_name');
      
      if (error) throw error;
      return data;
    },
  });

  const toggleTaskStatus = async (taskId: string, isPaused: boolean) => {
    try {
      const { error } = await supabase
        .from('rotating_tasks')
        .update({ is_paused: !isPaused })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: isPaused ? "Task resumed" : "Task paused",
        description: isPaused ? "Task will resume generating instances" : "Task will stop generating instances",
      });

      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };


  const getProfileName = (profileId: string) => {
    return profiles?.find(p => p.id === profileId)?.display_name || 'Unknown';
  };

  const getCadenceDisplay = (task: RotatingTask) => {
    switch (task.cadence) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        if (task.weekly_days && task.weekly_days.length > 0) {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return `Weekly (${task.weekly_days.map(d => days[d]).join(', ')})`;
        }
        return 'Weekly (Monday)';
      case 'monthly':
        return `Monthly (${task.monthly_day || 1}${getOrdinalSuffix(task.monthly_day || 1)})`;
      default:
        return task.cadence;
    }
  };

  const getOrdinalSuffix = (num: number) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  if (isLoading) {
    return (
      <div className="page-padding component-spacing">
        <div className="flex justify-between items-center section-spacing">
          <div>
            <PageHeading>Rotating Tasks</PageHeading>
            <SmallText>Manage tasks that rotate between family members</SmallText>
          </div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-padding component-spacing">
      <div className="flex justify-between items-center section-spacing">
        <div>
          <PageHeading>Rotating Tasks</PageHeading>
          <SmallText>Manage tasks that rotate between family members</SmallText>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rotating Task
        </Button>
      </div>

      {(!rotatingTasks || rotatingTasks.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No rotating tasks yet</h3>
            <p className="text-muted-foreground mb-4">
              Create rotating tasks that automatically assign themselves to different family members
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Rotating Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rotatingTasks.map((task) => (
            <Card key={task.id} className="transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {task.name}
                      <div className="flex gap-1">
                        {task.is_paused && (
                          <Badge variant="secondary">Paused</Badge>
                        )}
                        {!task.is_active && (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription>{task.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTaskStatus(task.id, task.is_paused)}
                    >
                       {task.is_paused ? (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Points:</span> {task.points}
                  </div>
                  <div>
                    <span className="font-medium">Schedule:</span> {getCadenceDisplay(task)}
                  </div>
                  <div>
                    <span className="font-medium">Current:</span>{' '}
                    {getProfileName(task.member_order[task.current_member_index])}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">Rotation:</span>
                    <div className="flex gap-1 flex-wrap">
                      {task.member_order.map((memberId, index) => (
                        <Badge
                          key={memberId}
                          variant={index === task.current_member_index ? "default" : "outline"}
                          className="text-xs"
                        >
                          {getProfileName(memberId)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddRotatingTaskDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          refetch();
          setIsAddDialogOpen(false);
        }}
      />

      <EditRotatingTaskDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        task={selectedTask}
        onSuccess={() => {
          refetch();
          setIsEditDialogOpen(false);
          setSelectedTask(null);
        }}
      />
    </div>
  );
}