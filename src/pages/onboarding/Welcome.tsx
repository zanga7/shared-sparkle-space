import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useToast } from '@/hooks/use-toast';
import { ThemedSvgAvatar } from '@/components/onboarding/ThemedSvgAvatar';
import { KawaiiFaceOverlay } from '@/components/ui/kawaii-face-overlay';
import { useMemo } from 'react';

// Import avatar SVG *as raw strings* so we can theme them via currentColor
import av1 from '@/assets/avatars/av1.svg?raw';
import av2 from '@/assets/avatars/av2.svg?raw';
import av3 from '@/assets/avatars/av3.svg?raw';
import av4 from '@/assets/avatars/av4.svg?raw';
import av5 from '@/assets/avatars/av5.svg?raw';
import av6 from '@/assets/avatars/av6.svg?raw';

const avatars = [av1, av2, av3, av4, av5, av6];

// Global colors from the palette
const AVATAR_COLORS = [
  '#0ea5e9', // sky
  '#005DE5', // blue
  '#f43f5e', // rose
  '#10b981', // emerald
  '#f59e0b', // amber
  '#9568E7', // violet
  '#FA8FE6', // pink
  '#4DBC4E', // green
  '#B6F202', // lime
  '#E6D726', // mustard
  '#FF7865', // melon
];

export default function Welcome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { completeOnboarding } = useOnboardingStatus();

  // Randomly assign colors to avatars (memoized so they don't change on re-render)
  const avatarColors = useMemo(() => {
    const shuffled = [...AVATAR_COLORS].sort(() => Math.random() - 0.5);
    return avatars.slice(0, 4).map((_, idx) => shuffled[idx % shuffled.length]);
  }, []);

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
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome Wild Ones
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-lg mx-auto">
              Let's get your crew set up in just a few quick steps. You can always skip and come back later!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 md:gap-4 pt-4">
          {avatars.slice(0, 4).map((avatar, idx) => (
            <div
              key={idx}
              className="relative h-10 w-10 md:h-14 md:w-14 animate-bounce"
              style={{
                animationDelay: `${0.2 + idx * 0.2}s`,
              }}
            >
              <ThemedSvgAvatar 
                svg={avatar} 
                className="w-full h-full" 
                style={{ color: avatarColors[idx] }}
              />
              <div className="absolute inset-0 flex items-center justify-center md:hidden">
                <KawaiiFaceOverlay size={40} faceStyle="happy" />
              </div>
              <div className="absolute inset-0 hidden md:flex items-center justify-center">
                <KawaiiFaceOverlay size={56} faceStyle="happy" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-4">
          <Button
            size="lg"
            onClick={() => navigate('/onboarding/plan')}
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

