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
      
      // Use secure server-side PIN authentication
      const { data, error } = await supabase.functions.invoke('secure-pin-auth', {
        body: { profileId, pin }
      });

      if (error) {
        console.error('Function invocation error:', error);
        toast({
          title: "Error",
          description: "Authentication service unavailable. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      const result = data;

      if (result.success) {
        setSelectedChildId(profileId);
        setIsChildAuthenticated(true);
        toast({
          title: "Welcome!",
          description: "Successfully logged in",
        });
        // Refresh profiles to get updated lock status
        await refreshProfiles();
        return true;
      } else {
        toast({
          title: "Authentication Failed",
          description: result.error || "Invalid PIN. Please try again.",
          variant: "destructive",
        });
        // Refresh profiles to get updated lock status
        await refreshProfiles();
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