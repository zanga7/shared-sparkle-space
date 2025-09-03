import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';

const NetworkStatusIndicator = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) {
    return null;
  }

  if (!isOnline) {
    return (
      <Alert className="fixed top-4 left-4 right-4 z-40 mx-auto max-w-sm bg-destructive/10 border-destructive/20">
        <WifiOff className="h-4 w-4" />
        <AlertDescription className="text-destructive">
          You're offline. Some features may be limited.
        </AlertDescription>
      </Alert>
    );
  }

  if (isOnline && wasOffline) {
    return (
      <Alert className="fixed top-4 left-4 right-4 z-40 mx-auto max-w-sm bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
        <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <AlertDescription className="text-emerald-700 dark:text-emerald-300">
          You're back online!
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export default NetworkStatusIndicator;