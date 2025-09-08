import { RewardsGallery } from '@/components/rewards/RewardsGallery';
import { ChildAuthProvider } from '@/hooks/useChildAuth';

export default function Rewards() {
  return (
    <ChildAuthProvider>
      <div className="min-h-screen bg-background w-full">
        <div className="w-full px-2 sm:px-4 lg:px-6 py-4 sm:py-8">
          <RewardsGallery />
        </div>
      </div>
    </ChildAuthProvider>
  );
}