import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Coins, Gift, Users } from 'lucide-react';
import { useRewards } from '@/hooks/useRewards';
import { toast } from 'sonner';
import type { Reward, GroupContribution } from '@/types/rewards';

interface GroupContributionCardProps {
  reward: Reward;
  userBalance: number;
  profileId: string;
  contributions: GroupContribution[];
  onContribute: (amount: number) => Promise<void>;
  isContributing?: boolean;
}

export function GroupContributionCard({ 
  reward, 
  userBalance, 
  profileId,
  contributions,
  onContribute, 
  isContributing 
}: GroupContributionCardProps) {
  
  // Check if this user has already contributed the full amount
  const userContribution = contributions.find(c => c.profile_id === profileId);
  const userContributedAmount = userContribution?.points_contributed || 0;
  const hasUserContributedFull = userContributedAmount >= reward.cost_points;
  
  // Get all unique contributors who have contributed the full amount
  const fullContributors = contributions.filter(c => c.points_contributed >= reward.cost_points);
  const contributorsCount = fullContributors.length;
  
  // Calculate how many members need to contribute (based on assigned_to)
  const requiredContributors = reward.assigned_to?.length || 1;
  const rewardCompleted = contributorsCount >= requiredContributors;

  const handleContribute = async () => {
    const amount = reward.cost_points;
    
    if (amount > userBalance) {
      toast.error('Insufficient points balance');
      return;
    }
    
    if (hasUserContributedFull) {
      toast.error('You have already contributed the full amount for this reward');
      return;
    }
    
    try {
      await onContribute(amount);
    } catch (error) {
      console.error('Contribution failed:', error);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      {reward.image_url && (
        <div className="aspect-video w-full overflow-hidden rounded-t-lg">
          <img 
            src={reward.image_url} 
            alt={reward.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{reward.title}</CardTitle>
          <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
            <Coins className="w-3 h-3" />
            {reward.cost_points}
          </Badge>
        </div>
        {reward.description && (
          <CardDescription className="text-sm">
            {reward.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>Group contribution required</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Contributors</span>
            <span>{contributorsCount} / {requiredContributors} members</span>
          </div>
          <Progress value={(contributorsCount / requiredContributors) * 100} className="h-2" />
        </div>
        
        {fullContributors.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Full Contributors:</p>
            <div className="flex flex-wrap gap-1">
              {fullContributors.map((contribution) => (
                <Badge key={contribution.id} variant="outline" className="text-xs">
                  {contribution.contributor?.display_name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {!rewardCompleted && !hasUserContributedFull && (
        <CardFooter className="flex-shrink-0">
          <div className="w-full space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Contribute {reward.cost_points} points to unlock this reward
              </p>
              <Button 
                onClick={handleContribute}
                disabled={reward.cost_points > userBalance || isContributing}
                variant="default"
                className="w-full"
              >
                {isContributing ? 'Contributing...' : `Contribute ${reward.cost_points} Points`}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Your balance: {userBalance} points
              </p>
            </div>
          </div>
        </CardFooter>
      )}
      
      {!rewardCompleted && hasUserContributedFull && (
        <CardFooter className="flex-shrink-0">
          <div className="w-full text-center space-y-2">
            <div className="text-sm text-green-600 font-medium">
              ✓ You've contributed {reward.cost_points} points
            </div>
            <p className="text-xs text-muted-foreground">
              Waiting for other members to contribute...
            </p>
          </div>
        </CardFooter>
      )}
      
      {rewardCompleted && (
        <CardFooter className="flex-shrink-0">
          <div className="w-full text-center">
            <Badge variant="default" className="bg-green-500">
              <Gift className="w-3 h-3 mr-1" />
              Goal Completed!
            </Badge>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}