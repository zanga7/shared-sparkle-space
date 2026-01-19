import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Sparkles, Rocket } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useToast } from '@/hooks/use-toast';
import { ThemedSvgAvatar } from '@/components/onboarding/ThemedSvgAvatar';

// Import avatar SVG *as raw strings* so we can theme them via currentColor
import av1 from '@/assets/avatars/av1.svg?raw';
import av2 from '@/assets/avatars/av2.svg?raw';
import av3 from '@/assets/avatars/av3.svg?raw';
import av4 from '@/assets/avatars/av4.svg?raw';
import av5 from '@/assets/avatars/av5.svg?raw';
import av6 from '@/assets/avatars/av6.svg?raw';

const avatars = [av1, av2, av3, av4, av5, av6];

export default function Complete() {
  const { toast } = useToast();
  const { completeOnboarding } = useOnboardingStatus();
  const hasCompleted = useRef(false);

  useEffect(() => {
    // Complete onboarding when this page loads (only once)
    if (!hasCompleted.current) {
      hasCompleted.current = true;
      completeOnboarding();
    }
  }, [completeOnboarding]);

  const handleGoToDashboard = async () => {
    const ok = await completeOnboarding();

    if (!ok) {
      toast({
        title: "Can't continue yet",
        description:
          "Your account isn't fully set up yet. If you just signed up, please verify your email, then try again.",
        variant: 'destructive',
      });
      return;
    }

    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full p-6 md:p-12 text-center space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="space-y-6">
          {/* Avatar celebration - no circle mask, no shadow */}
          <div className="flex justify-center items-center gap-2">
            {avatars.map((avatar, idx) => (
              <div
                key={idx}
                className="w-8 h-8 md:w-10 md:h-10 animate-bounce"
                style={{
                  animationDelay: `${idx * 0.15}s`,
                  animationDuration: '1.2s',
                }}
              >
                <ThemedSvgAvatar svg={avatar} className="w-full h-full text-primary" />
              </div>
            ))}
          </div>

          <div className="relative mx-auto w-24 h-24 md:w-32 md:h-32">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-primary" />
            </div>
          </div>

          <div className="space-y-3 md:space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              You're All Set!
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-lg mx-auto">
              Your family hub is ready to go. Time to organize, celebrate, and have some fun together!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-4">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
          <Rocket
            className="w-6 h-6 md:w-8 md:h-8 text-secondary animate-pulse"
            style={{ animationDelay: '0.2s' }}
          />
          <Sparkles
            className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse"
            style={{ animationDelay: '0.4s' }}
          />
        </div>

        <Button size="lg" onClick={handleGoToDashboard} className="text-base md:text-lg px-6 md:px-8">
          Go to Dashboard
        </Button>
      </Card>
    </div>
  );
}

