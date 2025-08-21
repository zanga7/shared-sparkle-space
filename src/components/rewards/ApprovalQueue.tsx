import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRewards } from '@/hooks/useRewards';
import { Check, X, Clock, User, Coins } from 'lucide-react';
import { format } from 'date-fns';
import type { RewardRequest } from '@/types/rewards';

export function ApprovalQueue() {
  const { rewardRequests, approveRewardRequest, denyRewardRequest, getPointsBalance } = useRewards();
  const [selectedRequest, setSelectedRequest] = useState<RewardRequest | null>(null);
  const [note, setNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  const pendingRequests = rewardRequests.filter(req => req.status === 'pending');

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setIsApproving(true);
    try {
      await approveRewardRequest(selectedRequest.id, note || undefined);
      setSelectedRequest(null);
      setNote('');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedRequest) return;
    
    setIsDenying(true);
    try {
      await denyRewardRequest(selectedRequest.id, note || undefined);
      setSelectedRequest(null);
      setNote('');
    } finally {
      setIsDenying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'denied': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (rewardRequests.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Reward Requests</h3>
        <p className="text-muted-foreground">
          When children request rewards, they'll appear here for approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Approval Queue</h2>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {pendingRequests.length} pending
        </Badge>
      </div>

      <div className="space-y-4">
        {rewardRequests.map((request) => {
          const currentBalance = getPointsBalance(request.requested_by);
          const canAfford = currentBalance >= request.points_cost;

          return (
            <Card key={request.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {request.reward?.title || 'Unknown Reward'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4" />
                      Requested by {request.requestor?.display_name || 'Unknown User'}
                    </CardDescription>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm">
                      <Coins className="w-4 h-4" />
                      {request.points_cost} points
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {request.reward?.description && (
                    <p className="text-sm text-muted-foreground">
                      {request.reward.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Requested: {format(new Date(request.created_at), 'PPp')}
                    </span>
                    <span className={`font-medium ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                      Current balance: {currentBalance} points
                    </span>
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            disabled={!canAfford}
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        </DialogTrigger>
                        
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Approve Reward Request</DialogTitle>
                            <DialogDescription>
                              Approve {request.requestor?.display_name}'s request for "{request.reward?.title}"?
                              This will deduct {request.points_cost} points from their balance.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="approval-note">Note (optional)</Label>
                              <Textarea
                                id="approval-note"
                                placeholder="Add a note about this approval..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleApprove} disabled={isApproving}>
                              {isApproving ? 'Approving...' : 'Approve'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Deny
                          </Button>
                        </DialogTrigger>
                        
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Deny Reward Request</DialogTitle>
                            <DialogDescription>
                              Deny {request.requestor?.display_name}'s request for "{request.reward?.title}"?
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="denial-note">Reason (optional)</Label>
                              <Textarea
                                id="denial-note"
                                placeholder="Explain why this request was denied..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeny} disabled={isDenying}>
                              {isDenying ? 'Denying...' : 'Deny'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {request.approval_note && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Note:</p>
                      <p className="text-sm text-muted-foreground">{request.approval_note}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}