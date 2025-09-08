import { supabase } from '@/integrations/supabase/client';
import { Task, Profile } from '@/types/task';

interface TaskCompletionParams {
  task: Task;
  completerId: string;
  completerProfile: Profile;
  familyMembers: Profile[];
}

interface TaskCompletionResult {
  success: boolean;
  message: string;
}

/**
 * Utility functions for task operations
 * Consolidates task completion logic that was duplicated across components
 */

export const executeTaskCompletion = async ({
  task,
  completerId,
  completerProfile,
  familyMembers
}: TaskCompletionParams): Promise<TaskCompletionResult> => {
  try {
    // Get all assignees for this task
    const assignees = task.assignees?.map(a => a.profile) || 
                     (task.assigned_profile ? [task.assigned_profile] : []);
    
    // Check if completer is allowed to complete this task
    const isAssignee = assignees.some(assignee => assignee.id === completerId);
    if (assignees.length > 0 && !isAssignee) {
      return {
        success: false,
        message: 'Only assigned members can complete this task.'
      };
    }
    
    // Determine point recipients based on completion rule
    let pointRecipients: Profile[];
    if (task.completion_rule === 'any_one' && assignees.length > 1) {
      // "Any one" rule: only the completer gets points
      pointRecipients = [completerProfile];
    } else {
      // "Everyone" rule or single assignee: only the completer gets points
      pointRecipients = [completerProfile];
    }
    
    // Create task completion record
    const { error: completionError } = await supabase
      .from('task_completions')
      .insert({
        task_id: task.id,
        completed_by: completerId,
        points_earned: task.points
      });

    if (completionError) {
      throw completionError;
    }

    // Award points to recipients
    const pointUpdates = pointRecipients.map(async (recipient) => {
      const currentProfile = familyMembers.find(m => m.id === recipient.id);
      if (currentProfile) {
        return supabase
          .from('profiles')
          .update({
            total_points: currentProfile.total_points + task.points
          })
          .eq('id', recipient.id);
      }
    });

    const updateResults = await Promise.all(pointUpdates.filter(Boolean));
    
    // Check for errors in point updates
    const updateErrors = updateResults.filter(result => result?.error);
    if (updateErrors.length > 0) {
      throw new Error('Failed to update some points');
    }

    // Create success message based on completion rule
    let message: string;
    if (task.completion_rule === 'any_one' && assignees.length > 1) {
      const assigneeNames = assignees.map(a => a.display_name).join(', ');
      message = `Task completed for everyone! ${completerProfile.display_name} earned ${task.points} points. Assignees: ${assigneeNames}`;
    } else if (pointRecipients.length === 1 && pointRecipients[0].id === completerId) {
      message = `You earned ${task.points} points!`;
    } else if (pointRecipients.length === 1) {
      message = `${pointRecipients[0].display_name} earned ${task.points} points!`;
    } else {
      const names = pointRecipients.map(p => p.display_name).join(', ');
      message = `${task.points} points awarded to: ${names}`;
    }

    return { success: true, message };
  } catch (error) {
    console.error('Error completing task:', error);
    return {
      success: false,
      message: 'Failed to complete task'
    };
  }
};

export const executeTaskUncompletion = async ({
  task,
  completerId,
  familyMembers
}: Omit<TaskCompletionParams, 'completerProfile'>): Promise<TaskCompletionResult> => {
  try {
    if (!task.task_completions || task.task_completions.length === 0) {
      return { success: false, message: 'No completion to remove' };
    }
    
    // Find the completion record by the current user
    const userCompletion = task.task_completions.find(completion => completion.completed_by === completerId);
    
    if (!userCompletion) {
      return { success: false, message: 'No completion found for this user' };
    }

    // Get point recipients (same logic as completion)
    const assignees = task.assignees?.map(a => a.profile) || 
                     (task.assigned_profile ? [task.assigned_profile] : []);
    
    let pointRecipients: Profile[];
    if (task.completion_rule === 'any_one' && assignees.length > 1) {
      const completerProfile = familyMembers.find(m => m.id === completerId);
      pointRecipients = completerProfile ? [completerProfile] : [];
    } else {
      const completerProfile = familyMembers.find(m => m.id === completerId);
      pointRecipients = completerProfile ? [completerProfile] : [];
    }

    // Remove the completion record
    const { error: deleteError } = await supabase
      .from('task_completions')
      .delete()
      .eq('id', userCompletion.id);

    if (deleteError) {
      throw deleteError;
    }

    // Remove points from recipients
    const pointUpdates = pointRecipients.map(async (recipient) => {
      const currentProfile = familyMembers.find(m => m.id === recipient.id);
      if (currentProfile) {
        return supabase
          .from('profiles')
          .update({
            total_points: currentProfile.total_points - task.points
          })
          .eq('id', recipient.id);
      }
    });

    const updateResults = await Promise.all(pointUpdates.filter(Boolean));
    
    // Check for errors in point updates
    const updateErrors = updateResults.filter(result => result?.error);
    if (updateErrors.length > 0) {
      throw new Error('Failed to update some points');
    }

    // Create message
    const message = pointRecipients.length === 1 
      ? `${task.points} points removed`
      : `${task.points} points removed from: ${pointRecipients.map(p => p.display_name).join(', ')}`;

    return { success: true, message };
  } catch (error) {
    console.error('Error uncompleting task:', error);
    return {
      success: false,
      message: 'Failed to uncomplete task'
    };
  }
};

export const deleteTask = async (taskId: string): Promise<TaskCompletionResult> => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Task has been removed successfully'
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    return {
      success: false,
      message: 'Failed to delete task'
    };
  }
};