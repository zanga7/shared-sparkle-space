import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, Plus, UserPlus } from 'lucide-react';
import { AddMemberDialog } from '@/components/admin/AddMemberDialog';
import { InviteParentDialog } from '@/components/onboarding/InviteParentDialog';
import { EditMyProfileCard } from '@/components/onboarding/EditMyProfileCard';
import { UserAvatar } from '@/components/ui/user-avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { toast } from 'sonner';

interface FamilyMember {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  role: string;
  status: string;
  user_id: string | null;
}

export default function CreateCrew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completeOnboarding } = useOnboardingStatus();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [showAddChildDialog, setShowAddChildDialog] = useState(false);
  const [showInviteParentDialog, setShowInviteParentDialog] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<FamilyMember | null>(null);

  useEffect(() => {
    loadMembers();
  }, [user]);

  const loadMembers = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id, display_name, color, avatar_url, role, status, user_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.family_id) {
      setFamilyId(profile.family_id);
      setCurrentUserProfile(profile as FamilyMember);

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, color, avatar_url, role, status, user_id')
        .eq('family_id', profile.family_id)
        .order('created_at');

      if (data) {
        setMembers(data as FamilyMember[]);
      }
    }
  };

  const handleSkip = async () => {
    const ok = await completeOnboarding();
    if (!ok) {
      toast.error(
        "Can't continue yet. If you just signed up, please verify your email, then try again."
      );
      return;
    }
    window.location.href = '/';
  };

  const handleContinue = () => {
    // At minimum, the current user exists as a member
    navigate('/onboarding/celebrations');
  };

  // Separate current user from other members for display
  const otherMembers = members.filter(m => m.id !== currentUserProfile?.id);
  const children = otherMembers.filter(m => m.role === 'child');
  const otherParents = otherMembers.filter(m => m.role === 'parent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-3xl w-full p-6 md:p-12 space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="text-center space-y-4">
          {/* Show member avatars as colorful header decoration */}
          {members.length > 0 ? (
            <div className="flex justify-center -space-x-3 mb-4">
              {members.slice(0, 6).map((member, idx) => (
                <div 
                  key={member.id} 
                  className="rounded-full transform hover:scale-110 transition-transform"
                  style={{ zIndex: 10 - idx }}
                >
                  <UserAvatar
                    name={member.display_name}
                    color={member.color}
                    avatarIcon={member.avatar_url || undefined}
                    size="lg"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-10 h-10 text-primary" />
            </div>
          )}
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">Create Your Crew</h1>
            <p className="text-muted-foreground text-lg">
              Set up your profile and add your family members
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Current User Profile Section */}
          {currentUserProfile && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Your Profile
              </h3>
              <EditMyProfileCard
                profileId={currentUserProfile.id}
                displayName={currentUserProfile.display_name}
                color={currentUserProfile.color}
                avatarUrl={currentUserProfile.avatar_url}
                existingMembers={members.map(m => ({ 
                  id: m.id, 
                  color: m.color, 
                  avatar_url: m.avatar_url, 
                  status: m.status 
                }))}
                onProfileUpdated={loadMembers}
              />
            </div>
          )}

          {/* Other Parents Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Other Parents / Guardians
              </h3>
              <Button
                onClick={() => setShowInviteParentDialog(true)}
                variant="outline"
                size="sm"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Add Parent
              </Button>
            </div>
            
            {otherParents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherParents.map((member) => (
                  <Card 
                    key={member.id} 
                    className="p-3 md:p-4 flex items-center gap-3 md:gap-4 border-l-4" 
                    style={{ borderLeftColor: 'hsl(var(--primary))' }}
                  >
                    <UserAvatar
                      name={member.display_name}
                      color={member.color}
                      avatarIcon={member.avatar_url || undefined}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{member.display_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.status === 'pending' ? 'Pending invite' : 'Parent'}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No other parents added yet. Add a partner or guardian to help manage the family.
              </p>
            )}
          </div>

          {/* Children Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Children
              </h3>
              <Button
                onClick={() => setShowAddChildDialog(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Child
              </Button>
            </div>
            
            {children.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children.map((member) => (
                  <Card 
                    key={member.id} 
                    className="p-3 md:p-4 flex items-center gap-3 md:gap-4 border-l-4" 
                    style={{ borderLeftColor: 'hsl(var(--secondary))' }}
                  >
                    <UserAvatar
                      name={member.display_name}
                      color={member.color}
                      avatarIcon={member.avatar_url || undefined}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{member.display_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">Child</p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No children added yet.</p>
                <Button
                  onClick={() => setShowAddChildDialog(true)}
                  variant="link"
                  className="mt-2"
                >
                  Add your first child
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-between pt-4 border-t">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
          >
            Skip to Dashboard
          </Button>
          <div className="flex gap-3 md:gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding/plan')}
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
        <>
          <AddMemberDialog
            isOpen={showAddChildDialog}
            onOpenChange={setShowAddChildDialog}
            familyId={familyId}
            onMemberAdded={loadMembers}
            existingMembers={members.map(m => ({ color: m.color, avatar_url: m.avatar_url, status: m.status }))}
          />
          <InviteParentDialog
            isOpen={showInviteParentDialog}
            onOpenChange={setShowInviteParentDialog}
            familyId={familyId}
            onParentAdded={loadMembers}
            existingMembers={members.map(m => ({ color: m.color, avatar_url: m.avatar_url, status: m.status }))}
          />
        </>
      )}
    </div>
  );
}
