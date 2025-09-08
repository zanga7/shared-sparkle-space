import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Task, Profile } from '@/types/task';

interface UseFamilyDataReturn {
  profile: Profile | null;
  familyMembers: Profile[];
  tasks: Task[];
  loading: boolean;
  profileError: string | null;
  refetch: () => Promise<void>;
}

/**
 * Centralized hook for managing family-related data
 * Consolidates profile, members, and tasks fetching with proper error handling
 */
export const useFamilyData = (): UseFamilyDataReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const createMissingProfile = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const { data: createResult, error: createError } = await supabase
        .rpc('fix_my_missing_profile');
      
      if (createError) {
        setProfileError('Failed to create profile. Please try signing out and back in.');
        return null;
      }
      
      if (createResult && typeof createResult === 'object' && 'success' in createResult && createResult.success) {
        // Retry fetching the profile
        const { data: retryProfileData, error: retryError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (retryError) {
          setProfileError('Profile creation succeeded but fetch failed. Please refresh the page.');
          return null;
        }
        
        return retryProfileData;
      } else {
        setProfileError('Failed to create missing profile. Please contact support.');
        return null;
      }
    } catch (error) {
      setProfileError('Failed to create profile. Please try again.');
      return null;
    }
  }, [user?.id]);

  const fetchFamilyMembers = useCallback(async (familyId: string) => {
    const { data: membersData, error: membersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('family_id', familyId)
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Members error:', membersError);
      return [];
    }
    
    return membersData || [];
  }, []);

  const fetchFamilyTasks = useCallback(async (familyId: string) => {
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        points,
        due_date,
        assigned_to,
        created_by,
        completion_rule,
        task_group,
        assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
        assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
        task_completions(id, completed_at, completed_by)
      `)
      .eq('family_id', familyId);

    if (tasksError) {
      console.error('Tasks error:', tasksError);
      return [];
    }
    
    // Type assertion to handle completion_rule from database
    return (tasksData || []).map(task => ({
      ...task,
      completion_rule: (task.completion_rule || 'everyone') as 'any_one' | 'everyone'
    }));
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setProfileError(null);
      
      // Fetch current user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let currentProfile = profileData;

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // Profile not found, try to create it
          currentProfile = await createMissingProfile();
          if (!currentProfile) return;
        } else {
          setProfileError('Failed to load profile. Please try refreshing the page.');
          return;
        }
      }

      setProfile(currentProfile);

      // Fetch family members and tasks in parallel
      const [members, familyTasks] = await Promise.all([
        fetchFamilyMembers(currentProfile.family_id),
        fetchFamilyTasks(currentProfile.family_id)
      ]);

      setFamilyMembers(members);
      setTasks(familyTasks);

    } catch (error) {
      console.error('Error fetching family data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
      setProfileError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, createMissingProfile, fetchFamilyMembers, fetchFamilyTasks, toast]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user, fetchUserData]);

  return {
    profile,
    familyMembers,
    tasks,
    loading,
    profileError,
    refetch: fetchUserData
  };
};