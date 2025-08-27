import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { RecurringTasksSimplified } from '@/components/RecurringTasksSimplified';
import { RecurringTaskManager } from '@/components/RecurringTaskManager';
import { useEffect } from 'react';

const RecurringTasksTest = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      
      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id);
        
      setFamilyMembers(membersData || []);
    }
  };

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recurring Tasks System Comparison</CardTitle>
          <CardDescription>
            Compare the old complex system vs the new simplified approach
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new">New Simplified System</TabsTrigger>
          <TabsTrigger value="old">Old Complex System</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-6">
          <RecurringTasksSimplified 
            familyId={profile.family_id}
            familyMembers={familyMembers}
          />
        </TabsContent>

        <TabsContent value="old" className="space-y-6 mt-6">
          <RecurringTaskManager 
            familyId={profile.family_id}
            familyMembers={familyMembers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecurringTasksTest;