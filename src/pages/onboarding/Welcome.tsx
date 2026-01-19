import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Rocket } from 'lucide-react';
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

export default function Welcome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { completeOnboarding } = useOnboardingStatus();

  const handleSkip = async () => {
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
        <div className="space-y-4">
          {/* Avatar decoration - no circle mask, no shadow */}
          <div className="flex justify-center items-center gap-2 mb-4">
            {avatars.map((avatar, idx) => (
              <div
                key={idx}
                className="w-10 h-10 md:w-12 md:h-12 animate-bounce"
                style={{
                  animationDelay: `${idx * 0.1}s`,
                  animationDuration: '1.5s',
                }}
              >
                <ThemedSvgAvatar svg={avatar} className="w-full h-full text-primary" />
              </div>
            ))}
          </div>

          <div className="mx-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Rocket className="w-10 h-10 md:w-12 md:h-12 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome to Your Family Hub!
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-lg mx-auto">
              Let's get your crew set up in just a few quick steps. You can always skip and come back later!
            </p>
          </div>
        </div>

        {/* Bottom avatars - no Users icon, no circle mask, no shadow */}
        <div className="flex items-center justify-center gap-3 md:gap-4 pt-4">
          {avatars.slice(0, 4).map((avatar, idx) => (
            <div
              key={idx}
              className="h-6 w-6 md:h-8 md:w-8 animate-bounce"
              style={{
                animationDelay: `${0.2 + idx * 0.2}s`,
              }}
            >
              <ThemedSvgAvatar svg={avatar} className="w-full h-full text-primary" />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-4">
          <Button
            size="lg"
            onClick={() => navigate('/onboarding/crew')}
            className="text-base md:text-lg px-6 md:px-8"
          >
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Start Setup
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleSkip}
            className="text-base md:text-lg px-6 md:px-8"
          >
            Skip to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}

