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
  
  // Calculate total contributed and remaining
  const totalContributed = contributions.reduce((sum, c) => sum + c.points_contributed, 0);
  const remainingNeeded = Math.max(0, reward.cost_points - totalContributed);
  const progressPercentage = Math.min(100, (totalContributed / reward.cost_points) * 100);
  
  // Check if this user has already contributed
  const userContribution = contributions.find(c => c.profile_id === profileId);
  const userContributedAmount = userContribution?.points_contributed || 0;

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
    
    if (amount > remainingNeeded) {
      toast.error(`Only ${remainingNeeded} points needed to complete this reward`);
      return;
    }
    
    try {
      await onContribute(amount);
      setContributionAmount('');
    } catch (error) {
      console.error('Contribution failed:', error);
    }
  };

  const isCompleted = totalContributed >= reward.cost_points;

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
            <span>Progress</span>
            <span>{totalContributed} / {reward.cost_points} points</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        {contributions.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Contributors:</p>
            <div className="flex flex-wrap gap-1">
              {contributions.map((contribution) => (
                <Badge key={contribution.id} variant="outline" className="text-xs">
                  {contribution.contributor?.display_name}: {contribution.points_contributed}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {userContributedAmount > 0 && (
          <div className="text-sm text-muted-foreground">
            You've contributed: {userContributedAmount} points
          </div>
        )}
      </CardContent>

      {!isCompleted && (
        <CardFooter className="flex-shrink-0 space-y-3">
          <div className="w-full space-y-2">
            <Label htmlFor={`contribution-${reward.id}`}>Contribute Points</Label>
            <div className="flex gap-2">
              <Input
                id={`contribution-${reward.id}`}
                type="number"
                placeholder="Amount"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                min="1"
                max={Math.min(userBalance, remainingNeeded)}
                className="flex-1"
              />
              <Button 
                onClick={handleContribute}
                disabled={!contributionAmount || parseInt(contributionAmount) <= 0 || parseInt(contributionAmount) > userBalance || isContributing}
                variant="default"
              >
                {isContributing ? 'Contributing...' : 'Contribute'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: {userBalance} points • Need: {remainingNeeded} more points
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