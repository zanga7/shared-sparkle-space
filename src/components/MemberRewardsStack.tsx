import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Clock, CheckCircle } from 'lucide-react';
import { Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { getMemberColorClasses } from '@/lib/utils';
import { useRewards } from '@/hooks/useRewards';
import { useToast } from '@/hooks/use-toast';
import { ChildAuthProvider } from '@/hooks/useChildAuth';

interface MemberRewardsStackProps {
  member: Profile;
}

export const MemberRewardsStack = ({ member }: MemberRewardsStackProps) => {
  const memberColors = getMemberColorClasses(member.color);
  const { rewards, rewardRequests, requestReward } = useRewards();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('available');

  // Filter rewards available to this member
  const availableRewards = rewards.filter(reward => 
    reward.is_active && 
    (!reward.assigned_to || reward.assigned_to.includes(member.id))
  );

  // Filter requests by this member
  const memberRequests = rewardRequests.filter(request => 
    request.requested_by === member.id
  );

  const pendingRequests = memberRequests.filter(req => req.status === 'pending');
  const approvedRequests = memberRequests.filter(req => req.status === 'approved');

  const handleRequestReward = async (rewardId: string, cost: number) => {
    if (member.total_points < cost) {
      toast({
        title: "Not enough points",
        description: "You don't have enough points for this reward.",
        variant: "destructive"
      });
      return;
    }

    try {
      await requestReward(rewardId, member.id);
      toast({
        title: "Reward requested!",
        description: "Your reward request has been submitted for approval."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request reward. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className={cn("h-full", memberColors.bg10)}>
      <CardHeader className="pb-4">
        <CardTitle className={cn("flex items-center gap-2 text-xl", memberColors.text)}>
          <Gift className="h-6 w-6" />
          Rewards
        </CardTitle>
        <CardDescription>
          {member.total_points} points available
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        <ChildAuthProvider>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="available">Available</TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pending
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Claimed</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-3 mt-4">
              {availableRewards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rewards available</p>
                </div>
              ) : (
                availableRewards.map((reward) => (
                  <div key={reward.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{reward.title}</h4>
                        {reward.description && (
                          <p className="text-sm text-muted-foreground">{reward.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {reward.cost_points} points
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={member.total_points < reward.cost_points}
                      onClick={() => handleRequestReward(reward.id, reward.cost_points)}
                    >
                      {member.total_points < reward.cost_points ? 'Not enough points' : 'Request'}
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-3 mt-4">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{request.reward?.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Requested on {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-3 mt-4">
              {approvedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No claimed rewards yet</p>
                </div>
              ) : (
                approvedRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{request.reward?.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Approved on {new Date(request.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Claimed
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </ChildAuthProvider>
      </CardContent>
    </Card>
  );
};