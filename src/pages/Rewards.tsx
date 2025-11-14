import { RewardsGallery } from '@/components/rewards/RewardsGallery';
import { ChildAuthProvider } from '@/hooks/useChildAuth';

export default function Rewards() {
  return (
    <ChildAuthProvider>
      <div className="min-h-screen bg-background">
        <div className="page-padding">
          <RewardsGallery />
        </div>
      </div>
    </ChildAuthProvider>
  );
}