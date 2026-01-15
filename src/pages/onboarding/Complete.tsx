import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Sparkles, Rocket } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
}

export default function Complete() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  // Fetch colors for decoration
  const { data: colors = [] } = useQuery({
    queryKey: ['color-palettes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_palettes')
        .select('*')
        .order('name')
        .limit(8);
      
      if (error) throw error;
      return data as ColorPalette[];
    }
  });

  useEffect(() => {
    completeOnboarding();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full p-6 md:p-12 text-center space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="space-y-6">
          {/* Colorful celebration dots */}
          <div className="flex justify-center items-center gap-2">
            {colors.slice(0, 6).map((color, idx) => (
              <div
                key={color.id}
                className="w-6 h-6 md:w-8 md:h-8 rounded-full animate-bounce shadow-lg"
                style={{ 
                  backgroundColor: color.hex_value,
                  animationDelay: `${idx * 0.15}s`,
                  animationDuration: '1.2s'
                }}
              />
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
          onClick={() => navigate('/')}
          className="text-base md:text-lg px-6 md:px-8"
        >
          Go to Dashboard
        </Button>
      </Card>
    </div>
  );
}
