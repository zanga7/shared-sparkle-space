import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  display_name: string;
  user_id: string | null;
  color: string;
  pin_locked_until: string | null;
}

interface ChildAuthContextType {
  childProfiles: Profile[];
  selectedChildId: string | null;
  loading: boolean;
  isChildAuthenticated: boolean;
  authenticateChild: (profileId: string, pin: string) => Promise<boolean>;
  selectChild: (profileId: string) => void;
  signOutChild: () => void;
  refreshProfiles: () => Promise<void>;
}

const ChildAuthContext = createContext<ChildAuthContextType | undefined>(undefined);

export const useChildAuth = () => {
  const context = useContext(ChildAuthContext);
  if (context === undefined) {
    throw new Error('useChildAuth must be used within a ChildAuthProvider');
  }
  return context;
};

export const ChildAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [childProfiles, setChildProfiles] = useState<Profile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChildAuthenticated, setIsChildAuthenticated] = useState(false);
  const { toast } = useToast();

  const refreshProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, user_id, color, pin_locked_until')
        .is('user_id', null) // Only child profiles
        .eq('status', 'active');

      if (error) throw error;
      setChildProfiles(data || []);
    } catch (error) {
      console.error('Error fetching child profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load child profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  const authenticateChild = async (profileId: string, pin: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // For now, use a simple PIN validation 
      // In production, this should use proper hashing and database validation
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .is('user_id', null)
        .single();

      if (error || !profile) {
        toast({
          title: "Authentication Failed",
          description: "Profile not found",
          variant: "destructive",
        });
        return false;
      }

      // Check if profile is locked
      if (profile.pin_locked_until && new Date(profile.pin_locked_until) > new Date()) {
        toast({
          title: "Account Locked",
          description: "Too many failed attempts. Try again later.",
          variant: "destructive",
        });
        return false;
      }

      // Simple PIN validation (replace with proper hashing in production)
      const storedPin = profile.pin_hash;
      if (storedPin && storedPin === pin) {
        // Reset failed attempts on successful login
        await supabase
          .from('profiles')
          .update({ failed_pin_attempts: 0, pin_locked_until: null })
          .eq('id', profileId);

        setSelectedChildId(profileId);
        setIsChildAuthenticated(true);
        toast({
          title: "Welcome!",
          description: "Successfully logged in",
        });
        return true;
      } else {
        // Increment failed attempts
        const newFailedAttempts = (profile.failed_pin_attempts || 0) + 1;
        const maxAttempts = 3; // Should come from household_settings
        const lockoutDuration = 300; // 5 minutes in seconds
        
        const updates: any = { failed_pin_attempts: newFailedAttempts };
        if (newFailedAttempts >= maxAttempts) {
          updates.pin_locked_until = new Date(Date.now() + lockoutDuration * 1000).toISOString();
        }

        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', profileId);

        toast({
          title: "Authentication Failed",
          description: newFailedAttempts >= maxAttempts 
            ? "Account locked due to too many failed attempts." 
            : "Invalid PIN. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: "Error",
        description: "Authentication failed. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const selectChild = (profileId: string) => {
    setSelectedChildId(profileId);
    setIsChildAuthenticated(false);
  };

  const signOutChild = () => {
    setSelectedChildId(null);
    setIsChildAuthenticated(false);
  };

  return (
    <ChildAuthContext.Provider value={{
      childProfiles,
      selectedChildId,
      loading,
      isChildAuthenticated,
      authenticateChild,
      selectChild,
      signOutChild,
      refreshProfiles
    }}>
      {children}
    </ChildAuthContext.Provider>
  );
};