import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Users, Rocket } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ColorPalette {
  id: string;
  name: string;
  color_key: string;
  hex_value: string;
}

export default function Welcome() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboardingStatus();

  // Fetch colors to display decorative elements
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

  const handleSkip = async () => {
    await completeOnboarding();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full p-6 md:p-12 text-center space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="space-y-4">
          {/* Colorful avatar circles decoration */}
          <div className="flex justify-center items-center gap-2 mb-4">
            {colors.slice(0, 6).map((color, idx) => (
              <div
                key={color.id}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full animate-bounce shadow-lg"
                style={{ 
                  backgroundColor: color.hex_value,
                  animationDelay: `${idx * 0.1}s`,
                  animationDuration: '1.5s'
                }}
              />
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

        <div className="flex items-center justify-center gap-3 md:gap-4 pt-4">
          <Users className="w-6 h-6 md:w-8 md:h-8 text-primary animate-pulse" />
          {colors.slice(0, 3).map((color, idx) => (
            <div 
              key={color.id}
              className="h-2 w-2 md:h-3 md:w-3 rounded-full animate-bounce" 
              style={{ 
                backgroundColor: color.hex_value,
                animationDelay: `${0.2 + idx * 0.2}s` 
              }} 
            />
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
