-- Create trigger to automatically award points when task is completed
DROP TRIGGER IF EXISTS award_points_on_completion ON public.task_completions;

CREATE TRIGGER award_points_on_completion
  AFTER INSERT ON public.task_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_task_completion_points();