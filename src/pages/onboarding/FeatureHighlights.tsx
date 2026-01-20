import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

export default function FeatureHighlights() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  const handleFinish = async () => {
    const ok = await completeOnboarding();
    if (!ok) {
      alert(
        "Can't continue yet. If you just signed up, please verify your email, then try again."
      );
      return;
    }
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-lg w-full p-8 md:p-12 space-y-8 shadow-xl my-4 text-center">
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold">You're all set!</h1>
            <p className="text-muted-foreground text-lg">
              Your family dashboard is ready. You can explore features and settings anytime from the menu.
            </p>
          </div>
        </div>

        <Button 
          size="lg" 
          onClick={handleFinish} 
          className="w-full text-lg py-6 gap-2"
        >
          Let's Go
          <ArrowRight className="w-5 h-5" />
        </Button>

        <Button 
          variant="ghost" 
          onClick={() => navigate('/onboarding/celebrations')}
          className="text-muted-foreground"
        >
          Back
        </Button>
      </Card>
    </div>
  );
}
