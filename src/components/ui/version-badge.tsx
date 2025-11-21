import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Build timestamp - update this with each deployment
const BUILD_VERSION = '2025-11-21-05:30';

export const VersionBadge = () => {
  const handleRefresh = () => {
    toast.success('Refreshing app...');
    // Clear cache and reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
    // Force reload from server
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 flex items-center gap-1">
      <Badge variant="outline" className="text-xs opacity-50 hover:opacity-100 transition-opacity">
        v{BUILD_VERSION}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-50 hover:opacity-100 transition-opacity"
        onClick={handleRefresh}
        title="Refresh app"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
};
