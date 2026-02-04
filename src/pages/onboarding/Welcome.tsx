import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useToast } from '@/hooks/use-toast';
import { ThemedSvgAvatar } from '@/components/onboarding/ThemedSvgAvatar';
import { KawaiiAvatar } from '@/components/ui/kawaii-avatar';
import { useColorPalette } from '@/contexts/ColorPaletteContext';
import { useMemo } from 'react';

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
  const { colors, getColorHex } = useColorPalette();

  // Randomly assign colors from the global color palette
  const avatarColors = useMemo(() => {
    const colorKeys = colors.length > 0 
      ? colors.map(c => c.color_key)
      : ['sky', 'blue', 'rose', 'emerald', 'amber', 'violet'];
    const shuffled = [...colorKeys].sort(() => Math.random() - 0.5);
    return avatars.slice(0, 4).map((_, idx) => getColorHex(shuffled[idx % shuffled.length]));
  }, [colors, getColorHex]);

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
    <div className="min-h-screen flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full p-6 md:p-12 text-center space-y-6 md:space-y-8 my-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome Wild Ones
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-lg mx-auto">
              Let's get your crew set up in just a few quick steps. You can always skip and come back later!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 md:gap-6 pt-4">
          {avatars.slice(0, 4).map((avatar, idx) => (
            <div
              key={idx}
              className="animate-bounce"
              style={{
                animationDelay: `${0.2 + idx * 0.2}s`,
              }}
            >
              <KawaiiAvatar size={56} className="md:hidden">
                <ThemedSvgAvatar 
                  svg={avatar} 
                  className="w-14 h-14" 
                  style={{ color: avatarColors[idx] }}
                />
              </KawaiiAvatar>
              <KawaiiAvatar size={80} className="hidden md:inline-flex">
                <ThemedSvgAvatar 
                  svg={avatar} 
                  className="w-20 h-20" 
                  style={{ color: avatarColors[idx] }}
                />
              </KawaiiAvatar>
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
      </div>
    </div>
  );
}

