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
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true; // iOS Safari standalone check
    setIsStandalone(isInStandaloneMode);

    // Don't show if already in standalone mode
    if (isInStandaloneMode) return;

    // Check if already dismissed
    const isDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';

    if (!isDismissed) {
      if (isIOSDevice) {
        // Show iOS instructions after a shorter delay for better visibility
        const timer = setTimeout(() => setShowInstallPrompt(true), 1500);
        return () => clearTimeout(timer);
      } else {
        // Listen for beforeinstallprompt event (Android/Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowInstallPrompt(true);
        };

        // Check if event was already fired before this component mounted
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    }
  }, []);

  // Also listen for storage changes (in case admin resets the dismissed flag)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pwa-install-dismissed' && e.newValue === null) {
        // Flag was removed, check if we should show prompt again
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        if (!isInStandaloneMode) {
          const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
          if (isIOSDevice) {
            setShowInstallPrompt(true);
          }
          // For Android, we'd need the beforeinstallprompt event which we can't re-trigger
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
    <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm bg-card/95 backdrop-blur-sm border-border shadow-lg animate-in slide-in-from-bottom-4 duration-300">
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
              <Share className="h-4 w-4 flex-shrink-0" />
              <span>Tap the <strong>Share</strong> button below</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 flex-shrink-0" />
              <span>Select <strong>"Add to Home Screen"</strong></span>
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