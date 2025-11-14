import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, 
  RotateCw, 
  Gift, 
  Calendar, 
  Image,
  ArrowRight 
} from 'lucide-react';

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
    description: 'Set up optional rewards to celebrate effort.',
    link: '/admin/rewards',
    color: 'text-purple-500'
  },
  {
    icon: Calendar,
    title: 'Holiday Management',
    description: 'Add school holidays, public holidays, and family breaks.',
    link: '/admin/holidays',
    color: 'text-green-500'
  },
  {
    icon: Image,
    title: 'Screen Saver Gallery',
    description: 'Choose fun photos or icons to show on your home hub.',
    link: '/admin/screensaver',
    color: 'text-orange-500'
  }
];

export default function FeatureHighlights() {
  const navigate = useNavigate();

  const handleFinish = () => {
    navigate('/onboarding/complete');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full p-8 md:p-12 space-y-8 shadow-xl">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">Explore Your Wild Tools</h1>
            <p className="text-muted-foreground text-lg">
              You can set these up anytime from Settings. No rush!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Card 
              key={feature.title}
              className="p-6 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate(feature.link)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-muted group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4 border-t">
          <Button 
            variant="ghost" 
            onClick={handleFinish}
          >
            Skip Features
          </Button>
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding/celebrations')}
            >
              Back
            </Button>
            <Button onClick={handleFinish}>
              Finish Setup
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
