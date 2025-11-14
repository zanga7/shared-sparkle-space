import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Users } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

export default function Welcome() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  const handleSkip = async () => {
    await completeOnboarding();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center space-y-8 shadow-xl">
        <div className="space-y-4">
          <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome to Your Family Hub!
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto">
              Let's get your crew set up in just a few quick steps. You can always skip and come back later!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 pt-4">
          <Users className="w-8 h-8 text-primary animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.6s' }} />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button 
            size="lg" 
            onClick={() => navigate('/onboarding/crew')}
            className="text-lg px-8"
          >
            Start Setup
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={handleSkip}
            className="text-lg px-8"
          >
            Skip and Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
