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
  const [contributionAmount, setContributionAmount] = useState<string>('');
  
  // Check if this user has already contributed the full amount
  const userContribution = contributions.find(c => c.profile_id === profileId);
  const userContributedAmount = userContribution?.points_contributed || 0;
  const hasUserContributedFull = userContributedAmount >= reward.cost_points;
  
  // Get all unique contributors who have contributed the full amount
  const fullContributors = contributions.filter(c => c.points_contributed >= reward.cost_points);
  const contributorsCount = fullContributors.length;
  
  // Calculate how many members need to contribute (based on assigned_to)
  const requiredContributors = reward.assigned_to?.length || 1;
  const isCompleted = contributorsCount >= requiredContributors;

  const handleContribute = async () => {
    const amount = parseInt(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid contribution amount');
      return;
    }
    
    if (amount > userBalance) {
      toast.error('Insufficient points balance');
      return;
    }
    
    if (hasUserContributedFull) {
      toast.error('You have already contributed the full amount for this reward');
      return;
    }
    
    if (amount !== reward.cost_points) {
      toast.error(`You must contribute exactly ${reward.cost_points} points for this group reward`);
      return;
    }
    
    try {
      await onContribute(amount);
      setContributionAmount('');
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
        
        {hasUserContributedFull && (
          <div className="text-sm text-green-600 font-medium">
            ✓ You've contributed the full amount
          </div>
        )}
      </CardContent>

      {!isCompleted && !hasUserContributedFull && (
        <CardFooter className="flex-shrink-0 space-y-3">
          <div className="w-full space-y-2">
            <Label htmlFor={`contribution-${reward.id}`}>Contribute {reward.cost_points} Points</Label>
            <div className="flex gap-2">
              <Input
                id={`contribution-${reward.id}`}
                type="number"
                placeholder={reward.cost_points.toString()}
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                min={reward.cost_points}
                max={reward.cost_points}
                className="flex-1"
              />
              <Button 
                onClick={handleContribute}
                disabled={!contributionAmount || parseInt(contributionAmount) !== reward.cost_points || parseInt(contributionAmount) > userBalance || isContributing}
                variant="default"
              >
                {isContributing ? 'Contributing...' : 'Contribute'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: {userBalance} points • Required: {reward.cost_points} points
            </p>
          </div>
        </CardFooter>
      )}
      
      {isCompleted && (
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