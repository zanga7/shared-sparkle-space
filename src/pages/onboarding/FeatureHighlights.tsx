import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, RotateCw, Gift, Target, Calendar, ArrowRight } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

const features = [
  {
    icon: RotateCw,
    title: 'Rotating Tasks',
    description: 'Create simple weekly tasks your crew can rotate through.',
    link: '/admin/rotating-tasks',
    color: 'text-blue-500'
  },
  {
    icon: Gift,
    title: 'Rewards',
    description: 'Set up optional rewards to celebrate effort and achievements.',
    link: '/admin/rewards',
    color: 'text-purple-500'
  },
  {
    icon: Target,
    title: 'Family Goals',
    description: 'Set goals together - track progress on projects, habits, and milestones.',
    link: '/goals',
    color: 'text-emerald-500'
  },
  {
    icon: Calendar,
    title: 'Holiday Management',
    description: 'Add school holidays, public holidays, and family breaks.',
    link: '/admin/holidays',
    color: 'text-orange-500'
  }
];

export default function FeatureHighlights() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  const handleFinish = async () => {
    await completeOnboarding();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-4xl w-full p-6 md:p-12 space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">Explore Your Wild Tools</h1>
            <p className="text-muted-foreground text-lg">
              You can set these up anytime from Settings. No rush!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className="p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer group border-l-4"
              style={{ borderLeftColor: 'hsl(var(--primary))' }}
              onClick={() => navigate(feature.link)}
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div className="p-2 md:p-3 rounded-lg bg-muted group-hover:scale-110 transition-transform">
                  <feature.icon className={`w-5 h-5 md:w-6 md:h-6 ${feature.color}`} />
                </div>
                <div className="flex-1 space-y-1 md:space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base md:text-lg">{feature.title}</h3>
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center pt-6 border-t">
          <Button size="lg" onClick={handleFinish} className="text-base md:text-lg px-6 md:px-8">
            Done! Take me to my Dashboard
          </Button>
          <Button variant="ghost" onClick={() => navigate('/onboarding/celebrations')}>
            Back
          </Button>
        </div>
      </Card>
    </div>
  );
}