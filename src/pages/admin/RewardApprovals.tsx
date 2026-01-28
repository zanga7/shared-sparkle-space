import { ApprovalQueue } from '@/components/rewards/ApprovalQueue';
import { PageHeading, SmallText } from '@/components/ui/typography';

export default function RewardApprovals() {
  return (
    <div className="page-padding component-spacing">
      <div className="section-spacing">
        <PageHeading>Reward Approvals</PageHeading>
        <SmallText>
          Review and manage pending reward requests from family members.
        </SmallText>
      </div>
      
      <ApprovalQueue />
    </div>
  );
}
