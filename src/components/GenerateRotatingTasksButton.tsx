import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GenerateRotatingTasksButtonProps {
  onTasksGenerated?: () => void;
}

export const GenerateRotatingTasksButton = ({ onTasksGenerated }: GenerateRotatingTasksButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-rotating-task-instances');
      
      if (error) throw error;

      toast({
        title: 'Rotating Tasks Generated',
        description: `Created ${data.tasksCreated} new task instances`,
      });

      if (onTasksGenerated) {
        onTasksGenerated();
      }
    } catch (error) {
      console.error('Error generating rotating tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate rotating tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={generateTasks} 
      disabled={loading}
      variant="outline"
      size="sm"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4 mr-2" />
      )}
      Generate Tasks
    </Button>
  );
};