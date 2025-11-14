import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

export default function Complete() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  useEffect(() => {
    completeOnboarding();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center space-y-8 shadow-xl">
        <div className="space-y-6">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-primary animate-scale" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              You're All Set!
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto">
              Your family hub is ready to go. Time to organize, celebrate, and have some fun together!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-4">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          <Sparkles className="w-8 h-8 text-secondary animate-pulse" style={{ animationDelay: '0.2s' }} />
          <Sparkles className="w-6 h-6 text-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>

        <Button 
          size="lg" 
          onClick={() => navigate('/')}
          className="text-lg px-8"
        >
          Go to Dashboard
        </Button>
      </Card>
    </div>
  );
}

// Add animation keyframes in index.css if needed
