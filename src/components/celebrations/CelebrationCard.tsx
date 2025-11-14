import { Celebration } from '@/types/celebration';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cake, Heart, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface CelebrationCardProps {
  celebration: Celebration;
  onClick?: () => void;
}

export const CelebrationCard = ({ celebration, onClick }: CelebrationCardProps) => {
  const getCelebrationIcon = () => {
    switch (celebration.celebration_type) {
      case 'birthday':
        return <Cake className="h-4 w-4" />;
      case 'anniversary':
        return <Heart className="h-4 w-4" />;
      default:
        return <Gift className="h-4 w-4" />;
    }
  };

  const getPhotoUrl = () => {
    if (!celebration.photo_url) return null;
    const { data } = supabase.storage
      .from('celebration-photos')
      .getPublicUrl(celebration.photo_url);
    return data.publicUrl;
  };

  const celebrationDate = celebration.currentYearDate 
    ? new Date(celebration.currentYearDate)
    : new Date(celebration.celebration_date);

  return (
    <Card 
      className="bg-background border-border hover:border-primary transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="grid-card-content">
        <div className="flex items-start gap-3">
          {/* Visual (photo or icon) */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {celebration.visual_type === 'photo' && celebration.photo_url ? (
              <img
                src={getPhotoUrl() || ''}
                alt={celebration.name}
                className="w-full h-full object-cover"
              />
            ) : celebration.visual_type === 'icon' && celebration.icon ? (
              <div
                className="w-6 h-6 text-primary"
                dangerouslySetInnerHTML={{ __html: celebration.icon.svg_content }}
              />
            ) : (
              <Gift className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {celebration.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {format(celebrationDate, 'MMMM d')}
              {celebration.year_specific && ` • ${celebration.year_specific}`}
            </p>
            {celebration.age !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Turning {celebration.age}
              </p>
            )}
          </div>

          {/* Type badge */}
          <Badge variant="outline" className="flex items-center gap-1 flex-shrink-0">
            {getCelebrationIcon()}
            <span className="capitalize">{celebration.celebration_type}</span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
