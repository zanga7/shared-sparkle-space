import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
// @ts-ignore - PWA types will be available after build
import { useRegisterSW } from 'virtual:pwa-register/react';

const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setShowUpdatePrompt(true);
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });

  const handleUpdate = () => {
    updateServiceWorker(true);
    setShowUpdatePrompt(false);
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    setNeedRefresh(false);
  };

  if (!showUpdatePrompt || !needRefresh) {
    return null;
  }

  return (
    <Card className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm bg-card/95 backdrop-blur-sm border-border shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Update Available</h3>
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
          A new version of the app is available. Update now for the latest features and improvements.
        </p>

        <div className="flex gap-2">
          <Button onClick={handleUpdate} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Update Now
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWAUpdatePrompt;