import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Check if already installed (standalone mode)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);

    // Check if already dismissed
    const isDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';

    if (!isInStandaloneMode && !isDismissed) {
      if (isIOSDevice) {
        // Show iOS instructions after a delay
        setTimeout(() => setShowInstallPrompt(true), 3000);
      } else {
        // Listen for beforeinstallprompt event (Android/Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showInstallPrompt || isStandalone) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm bg-card/95 backdrop-blur-sm border-border shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Install App</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-auto p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {isIOS 
            ? "Add this app to your home screen for the best experience"
            : "Install this app for quick access and offline use"
          }
        </p>

        {isIOS ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Share className="h-4 w-4" />
              <span>Tap the share button</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>Select "Add to Home Screen"</span>
            </div>
          </div>
        ) : (
          <Button onClick={handleInstall} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PWAInstallPrompt;