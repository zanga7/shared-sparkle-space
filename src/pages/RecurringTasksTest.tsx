import React, { useState, useEffect } from 'react';
import { RecurringTaskManager } from '@/components/RecurringTaskManager';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function RecurringTasksTest() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (profileError) throw profileError;
        setProfile(profileData);
        
        // Get family members
        const { data: membersData, error: membersError } = await supabase
          .from('profiles')
          .select('*')
          .eq('family_id', profileData.family_id);
          
        if (membersError) throw membersError;
        setFamilyMembers(membersData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  if (!user) {
    return <div>Please log in to view recurring tasks</div>;
  }
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!profile) {
    return <div>Profile not found</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <RecurringTaskManager 
        familyId={profile.family_id} 
        familyMembers={familyMembers}
      />
    </div>
  );
}