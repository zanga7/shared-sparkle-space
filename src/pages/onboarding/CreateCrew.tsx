import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, Plus } from 'lucide-react';
import { AddMemberDialog } from '@/components/admin/AddMemberDialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FamilyMember {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  role: string;
}

export default function CreateCrew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, [user]);

  const loadMembers = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.family_id) {
      setFamilyId(profile.family_id);

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, color, avatar_url, role')
        .eq('family_id', profile.family_id)
        .order('created_at');

      if (data) {
        setMembers(data as FamilyMember[]);
      }
    }
  };

  const handleContinue = () => {
    if (members.length === 0) {
      toast.error('Please add at least one family member to continue');
      return;
    }
    navigate('/onboarding/celebrations');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full p-8 md:p-12 space-y-8 shadow-xl">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">Create Your Crew</h1>
            <p className="text-muted-foreground text-lg">
              Add your family members so everyone can join in the fun!
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((member) => (
                <Card key={member.id} className="p-4 flex items-center gap-4">
                  <UserAvatar
                    name={member.display_name}
                    color={member.color}
                    avatarIcon={member.avatar_url || undefined}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.display_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No family members yet. Add your first member to get started!</p>
            </div>
          )}

          <Button
            onClick={() => setShowAddDialog(true)}
            variant="outline"
            size="lg"
            className="w-full"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Family Member
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4 border-t">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/onboarding/celebrations')}
            disabled={members.length === 0}
          >
            Skip for Now
          </Button>
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding/welcome')}
            >
              Back
            </Button>
            <Button onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      </Card>

      {familyId && (
        <AddMemberDialog
          isOpen={showAddDialog}
          onOpenChange={setShowAddDialog}
          familyId={familyId}
          onMemberAdded={loadMembers}
        />
      )}
    </div>
  );
}
