import { ApprovalQueue } from '@/components/rewards/ApprovalQueue';

export default function RewardApprovals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reward Approvals</h1>
        <p className="text-muted-foreground">
          Review and manage pending reward requests from family members.
        </p>
      </div>
      
      <ApprovalQueue />
    </div>
  );
}