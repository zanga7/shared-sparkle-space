import { RewardsGallery } from '@/components/rewards/RewardsGallery';
import { ChildAuthProvider } from '@/hooks/useChildAuth';

export default function Rewards() {
  return (
    <ChildAuthProvider>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 md:px-3 lg:px-6 py-8">
          <RewardsGallery />
        </div>
      </div>
    </ChildAuthProvider>
  );
}