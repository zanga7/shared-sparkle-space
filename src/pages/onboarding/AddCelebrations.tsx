import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cake, Plus } from 'lucide-react';
import { AddCelebrationDialog } from '@/components/celebrations/AddCelebrationDialog';
import { CelebrationCard } from '@/components/celebrations/CelebrationCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCelebrations } from '@/hooks/useCelebrations';

export default function AddCelebrations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const celebrationsQuery = useCelebrations(familyId || undefined);
  const celebrations = celebrationsQuery.data || [];

  useEffect(() => {
    loadFamilyId();
  }, [user]);

  const loadFamilyId = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.family_id) {
      setFamilyId(profile.family_id);
      setProfileId(profile.id);
    }
  };

  const handleContinue = () => {
    navigate('/onboarding/features');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full p-8 md:p-12 space-y-8 shadow-xl">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Cake className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">Add Celebrations</h1>
            <p className="text-muted-foreground text-lg">
              Never miss a birthday or special day! Add them now or skip and add them later.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {celebrations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {celebrations.slice(0, 6).map((celebration) => (
                <CelebrationCard 
                  key={celebration.id} 
                  celebration={celebration}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Cake className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No celebrations yet. Add birthdays and special days!</p>
            </div>
          )}

          <Button
            onClick={() => setShowAddDialog(true)}
            variant="outline"
            size="lg"
            className="w-full"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Celebration
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4 border-t">
          <Button 
            variant="ghost" 
            onClick={handleContinue}
          >
            Skip for Now
          </Button>
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding/crew')}
            >
              Back
            </Button>
            <Button onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      </Card>

      {familyId && profileId && (
        <AddCelebrationDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          familyId={familyId}
          profileId={profileId}
        />
      )}
    </div>
  );
}
