import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Gift } from 'lucide-react';
import type { Reward } from '@/types/rewards';

interface RewardCardProps {
  reward: Reward;
  userBalance: number;
  canRequest: boolean;
  onRequest: () => void;
  isRequesting?: boolean;
}

export function RewardCard({ reward, userBalance, canRequest, onRequest, isRequesting }: RewardCardProps) {
  const canAfford = userBalance >= reward.cost_points;
  const isEligible = canRequest && canAfford;

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

      <CardContent className="flex-grow">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gift className="w-4 h-4" />
          <span>
            {reward.reward_type === 'once_off' 
              ? 'One-time reward' 
              : reward.reward_type === 'group_contribution' 
                ? 'Group contribution required'
                : 'Always available'
            }
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex-shrink-0">
        <Button 
          onClick={onRequest}
          disabled={!isEligible || isRequesting}
          className="w-full"
          variant={isEligible ? "default" : "outline"}
        >
          {isRequesting ? (
            'Requesting...'
          ) : !canRequest ? (
            'Not Available'
          ) : !canAfford ? (
            `Need ${reward.cost_points - userBalance} more points`
          ) : reward.reward_type === 'group_contribution' ? (
            'Contribute Points'
          ) : (
            'Request Reward'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}