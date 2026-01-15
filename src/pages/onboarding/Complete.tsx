import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Sparkles, Rocket } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

// Import avatar images
import av1 from '@/assets/avatars/av1.svg';
import av2 from '@/assets/avatars/av2.svg';
import av3 from '@/assets/avatars/av3.svg';
import av4 from '@/assets/avatars/av4.svg';
import av5 from '@/assets/avatars/av5.svg';
import av6 from '@/assets/avatars/av6.svg';

const avatars = [av1, av2, av3, av4, av5, av6];

export default function Complete() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  useEffect(() => {
    // Complete onboarding when this page loads
    completeOnboarding();
  }, [completeOnboarding]);

  const handleGoToDashboard = async () => {
    await completeOnboarding();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full p-6 md:p-12 text-center space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="space-y-6">
          {/* Avatar celebration circles */}
          <div className="flex justify-center items-center gap-2">
            {avatars.map((avatar, idx) => (
              <div
                key={idx}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full animate-bounce shadow-lg bg-background overflow-hidden"
                style={{ 
                  animationDelay: `${idx * 0.15}s`,
                  animationDuration: '1.2s'
                }}
              >
                <img src={avatar} alt="" className="w-full h-full object-cover" />
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
          <Rocket className="w-6 h-6 md:w-8 md:h-8 text-secondary animate-pulse" style={{ animationDelay: '0.2s' }} />
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>

        <Button 
          size="lg" 
          onClick={handleGoToDashboard}
          className="text-base md:text-lg px-6 md:px-8"
        >
          Go to Dashboard
        </Button>
      </Card>
    </div>
  );
}
