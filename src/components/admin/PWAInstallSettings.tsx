import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallSettings() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Auto-reset the dismissed prompt when accessing this page
    localStorage.removeItem('pwa-install-dismissed');

    // Check if already installed
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        toast({
          title: 'App Installed!',
          description: 'The app has been added to your device.',
        });
        setDeferredPrompt(null);
        setCanInstall(false);
      }
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          App Installation
        </CardTitle>
        <CardDescription>
          Install the app on your device for the best experience with offline access and quick launch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStandalone ? (
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">App Already Installed</p>
              <p className="text-sm text-muted-foreground">
                You're running the installed version of the app.
              </p>
            </div>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-400">iOS Installation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  To install on iOS:
                </p>
                <ol className="text-sm text-muted-foreground mt-2 list-decimal list-inside space-y-1">
                  <li>Tap the Share button in Safari</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" to confirm</li>
                </ol>
              </div>
            </div>
          </div>
        ) : canInstall ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Click the button below to install the app on this device.
            </p>
            <Button onClick={handleInstall} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Install App Now
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-muted/50 border rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Installation Not Available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your browser doesn't support app installation, or the app is already installed.
                Try using Chrome or Edge on desktop, or Safari on iOS.
              </p>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
