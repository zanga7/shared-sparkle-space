import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useRewards } from '@/hooks/useRewards';
import { Check, X, Clock, User, Coins, RotateCcw, CheckCircle, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { RewardRequest } from '@/types/rewards';

interface Profile {
  id: string;
  display_name: string;
  role: string;
}

export function ApprovalQueue() {
  const { rewardRequests, approveRewardRequest, denyRewardRequest, revokeRewardRequest, markRewardClaimed, getPointsBalance } = useRewards();
  const [selectedRequest, setSelectedRequest] = useState<RewardRequest | null>(null);
  const [note, setNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isDenying, setIsDenying] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('all');

  const pendingRequests = rewardRequests.filter(req => req.status === 'pending');
  
  // Filter requests by selected member
  const filteredRequests = selectedMember === 'all' 
    ? rewardRequests 
    : rewardRequests.filter(req => req.requested_by === selectedMember);

  // Fetch family members for filter
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, role')
          .order('display_name');
        
        if (error) throw error;
        setFamilyMembers(data || []);
      } catch (error) {
        console.error('Error fetching family members:', error);
      }
    };

    fetchFamilyMembers();
  }, []);

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

  const handleRevoke = async () => {
    if (!selectedRequest) return;
    
    setIsRevoking(true);
    try {
      await revokeRewardRequest(selectedRequest.id, note || undefined);
      setSelectedRequest(null);
      setNote('');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleMarkClaimed = async () => {
    if (!selectedRequest) return;
    
    setIsClaiming(true);
    try {
      await markRewardClaimed(selectedRequest.id);
      setSelectedRequest(null);
      setNote('');
    } finally {
      setIsClaiming(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'denied': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'claimed': return 'bg-blue-100 text-blue-800 border-blue-200';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Approval Queue</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {familyMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {filteredRequests.filter(req => req.status === 'pending').length} pending
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {filteredRequests.map((request) => {
          const currentBalance = getPointsBalance(request.requested_by);
          const canAfford = currentBalance >= request.points_cost;

          return (
            <Card key={request.id} className="relative">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        name={request.requestor?.display_name || 'Unknown User'}
                        color={request.requestor?.color || 'sky'}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm truncate">
                          {request.reward?.title || 'Unknown Reward'}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{request.requestor?.display_name || 'Unknown User'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            {request.points_cost}
                          </span>
                          <span>•</span>
                          <span>{format(new Date(request.created_at), 'MMM d')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(request.status)} variant="secondary">
                      {request.status}
                    </Badge>

                    {request.status === 'pending' && (
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              disabled={!canAfford}
                              onClick={() => setSelectedRequest(request)}
                            >
                              <Check className="w-3 h-3 mr-1" />
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
                              <X className="w-3 h-3 mr-1" />
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

                    {request.status === 'approved' && (
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              onClick={() => setSelectedRequest(request)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Mark Claimed
                            </Button>
                          </DialogTrigger>
                          
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Mark as Claimed</DialogTitle>
                              <DialogDescription>
                                Mark {request.requestor?.display_name}'s reward "{request.reward?.title}" as claimed?
                              </DialogDescription>
                            </DialogHeader>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleMarkClaimed} disabled={isClaiming}>
                                {isClaiming ? 'Marking...' : 'Mark Claimed'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => setSelectedRequest(request)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Revoke
                            </Button>
                          </DialogTrigger>
                          
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Revoke Reward</DialogTitle>
                              <DialogDescription>
                                Revoke {request.requestor?.display_name}'s reward "{request.reward?.title}" and refund {request.points_cost} points?
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="revoke-note">Reason (optional)</Label>
                                <Textarea
                                  id="revoke-note"
                                  placeholder="Explain why this reward was revoked..."
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                />
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                                Cancel
                              </Button>
                              <Button variant="destructive" onClick={handleRevoke} disabled={isRevoking}>
                                {isRevoking ? 'Revoking...' : 'Revoke & Refund'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                  </div>
                </div>

                {request.approval_note && (
                  <div className="mt-3 p-2 bg-muted rounded text-xs">
                    <span className="font-medium">Note:</span> {request.approval_note}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}