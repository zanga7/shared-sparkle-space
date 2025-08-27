import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GenerationResult {
  inserted_count: number;
  skipped_count: number;
  errors: string[];
  duration_ms: number;
}

export const useTaskGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);
  const { toast } = useToast();

  const generateTasks = useCallback(async (
    familyId: string, 
    windowStart: Date, 
    windowEnd: Date,
    retryCount = 0
  ): Promise<GenerationResult | null> => {
    
    // Prevent concurrent generation
    if (generatingRef.current || isGenerating) {
      console.log('Task generation already in progress, skipping...');
      return null;
    }

    generatingRef.current = true;
    setIsGenerating(true);

    try {
      console.log(`Generating tasks for family ${familyId} from ${windowStart.toISOString()} to ${windowEnd.toISOString()} (attempt ${retryCount + 1})`);

      const { data, error } = await supabase.functions.invoke('generate-tasks-unified', {
        body: {
          family_id: familyId,
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString()
        }
      });

      if (error) throw error;

      const result = data as GenerationResult;
      
      console.log(`Task generation complete:`, result);

      // Show success/warning toast based on results
      if (result.errors.length > 0) {
        toast({
          title: 'Tasks Generated with Warnings',
          description: `${result.inserted_count} tasks created, ${result.errors.length} errors occurred`,
          variant: 'default',
        });
      } else if (result.inserted_count > 0) {
        toast({
          title: 'Tasks Generated',
          description: `${result.inserted_count} new tasks created for the selected period`,
        });
      }

      return result;

    } catch (error) {
      console.error('Error generating tasks:', error);
      
      // Implement exponential backoff for retries (max 3 attempts)
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s exponential backoff
        console.log(`Retrying task generation in ${delay}ms...`);
        
        setTimeout(() => {
          generateTasks(familyId, windowStart, windowEnd, retryCount + 1);
        }, delay);
        
        toast({
          title: 'Generation Failed - Retrying',
          description: `Attempt ${retryCount + 1} failed. Retrying in ${delay / 1000}s...`,
          variant: 'default',
        });
        
        return null;
      }
      
      toast({
        title: 'Generation Failed',
        description: `Failed to generate recurring tasks after ${retryCount + 1} attempts. Please check logs.`,
        variant: 'destructive',
      });
      return null;
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [toast, isGenerating]);

  const generateForCurrentMonth = useCallback(async (familyId: string) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    return generateTasks(familyId, start, end);
  }, [generateTasks]);

  const generateForDateRange = useCallback(async (
    familyId: string, 
    start: Date, 
    end: Date
  ) => {
    return generateTasks(familyId, start, end);
  }, [generateTasks]);

  return {
    generateTasks,
    generateForCurrentMonth,
    generateForDateRange,
    isGenerating,
  };
};