import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  display_name: string;
  color: string;
  role: 'parent' | 'child';
  require_pin_to_complete_tasks: boolean;
  require_pin_for_list_deletes: boolean;
  calendar_edit_permission: 'open' | 'require_pin';
  pin_hash?: string | null;
}

interface DashboardSession {
  device_id: string;
  active_member_id: string;
  pin_cache_expires: string | null;
}

export const useDashboardAuth = () => {
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [pinCache, setPinCache] = useState<Record<string, boolean>>({});
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { toast } = useToast();

  // Get device ID for session management
  const getDeviceId = useCallback(() => {
    return navigator.userAgent || 'unknown-device';
  }, []);

  // Load dashboard session on mount
  useEffect(() => {
    const loadDashboardSession = async () => {
      try {
        const deviceId = getDeviceId();
        const { data, error } = await supabase
          .from('dashboard_sessions')
          .select('*')
          .eq('device_id', deviceId)
          .single();

        if (data && !error) {
          setActiveMemberId(data.active_member_id);
          
          // Check if PIN cache is still valid
          if (data.pin_cache_expires && new Date(data.pin_cache_expires) > new Date()) {
            setPinCache(prev => ({ ...prev, [data.active_member_id]: true }));
          }
        }
      } catch (error) {
        console.log('No existing dashboard session found');
      }
    };

    loadDashboardSession();
  }, [getDeviceId]);

  // Switch to a different member
  const switchToMember = useCallback(async (memberId: string, profile?: Profile) => {
    setActiveMemberId(memberId);
    
    // Update dashboard session
    try {
      const deviceId = getDeviceId();
      await supabase
        .from('dashboard_sessions')
        .upsert({
          device_id: deviceId,
          active_member_id: memberId,
          last_activity: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to update dashboard session:', error);
    }

    toast({
      title: "Switched Member",
      description: `Now acting as ${profile?.display_name || 'selected member'}`,
    });
  }, [getDeviceId, toast]);

  // Authenticate member with PIN
  const authenticateMemberPin = useCallback(async (memberId: string, pin: string): Promise<boolean> => {
    setIsAuthenticating(true);
    
    try {
      const { data, error } = await supabase.rpc('authenticate_member_pin_dashboard', {
        profile_id_param: memberId,
        pin_attempt: pin
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (result.success) {
        // Update PIN cache
        setPinCache(prev => ({ ...prev, [memberId]: true }));
        
        // Set timer to clear cache after 5 minutes
        setTimeout(() => {
          setPinCache(prev => {
            const updated = { ...prev };
            delete updated[memberId];
            return updated;
          });
        }, 5 * 60 * 1000);

        toast({
          title: "PIN Verified",
          description: result.message || "Authentication successful",
        });
        
        return true;
      } else {
        toast({
          title: "PIN Failed",
          description: result.error || "Invalid PIN",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('PIN authentication error:', error);
      toast({
        title: "Authentication Error",
        description: "Failed to verify PIN. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [toast]);

  // Check if member can perform action (PIN cache or no PIN required)
  const canPerformAction = useCallback(async (memberId: string, actionType: 'task_completion' | 'list_delete'): Promise<{ canProceed: boolean; needsPin: boolean; profile?: any }> => {
    try {
      // Get member profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .single();

      if (error || !profileData) {
        return { canProceed: false, needsPin: false };
      }

      // Create a compatible profile object
      const profile: Profile = {
        id: profileData.id,
        display_name: profileData.display_name,
        color: profileData.color,
        role: profileData.role as 'parent' | 'child',
        require_pin_to_complete_tasks: profileData.require_pin_to_complete_tasks || false,
        require_pin_for_list_deletes: profileData.require_pin_for_list_deletes || false,
        calendar_edit_permission: (profileData.calendar_edit_permission as 'open' | 'require_pin') || 'open',
        pin_hash: profileData.pin_hash
      };

      const requiresPin = actionType === 'task_completion' 
        ? profile.require_pin_to_complete_tasks
        : profile.require_pin_for_list_deletes;

      // If no PIN required, can proceed
      if (!requiresPin || !profile.pin_hash) {
        return { canProceed: true, needsPin: false, profile };
      }

      // Check if PIN is cached
      const hasCachedPin = pinCache[memberId] || false;
      
      if (hasCachedPin) {
        // Verify cache is still valid on server
        const { data: cacheValid } = await supabase.rpc('check_member_pin_cache', {
          profile_id_param: memberId,
          device_id_param: getDeviceId()
        });

        if (cacheValid) {
          return { canProceed: true, needsPin: false, profile };
        } else {
          // Clear invalid cache
          setPinCache(prev => {
            const updated = { ...prev };
            delete updated[memberId];
            return updated;
          });
        }
      }

      return { canProceed: false, needsPin: true, profile };
    } catch (error) {
      console.error('Error checking action permissions:', error);
      return { canProceed: false, needsPin: false };
    }
  }, [pinCache, getDeviceId]);

  return {
    activeMemberId,
    switchToMember,
    authenticateMemberPin,
    canPerformAction,
    isAuthenticating,
    pinCache,
  };
};