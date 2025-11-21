import { Badge } from '@/components/ui/badge';

export const VersionBadge = () => {
  return (
    <div className="fixed bottom-2 right-2 z-50">
      <Badge variant="outline" className="text-xs opacity-50 hover:opacity-100 transition-opacity">
        v1.0.0
      </Badge>
    </div>
  );
};
