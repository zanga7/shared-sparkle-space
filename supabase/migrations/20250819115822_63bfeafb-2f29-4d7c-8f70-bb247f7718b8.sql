-- Add DELETE policy for task_completions so users can uncomplete their own tasks
CREATE POLICY "Users can delete their own completions" 
ON public.task_completions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE profiles.id = task_completions.completed_by 
    AND profiles.user_id = auth.uid()
  )
);