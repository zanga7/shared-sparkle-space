import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Dynamic build version - generated at build time
const BUILD_VERSION = new Date().toISOString().slice(0, 16).replace('T', ' ');

export const VersionBadge = () => {
  const handleRefresh = async () => {
    toast.success('Clearing caches and refreshing...');
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // Clear localStorage version to force fresh state
    localStorage.removeItem('app_version');
    
    // Force reload from server
    setTimeout(() => {
      window.location.reload();
    }, 300);
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
        title="Clear cache and refresh"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
};
