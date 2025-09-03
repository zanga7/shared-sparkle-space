import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const OfflinePage = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 p-3 rounded-full bg-muted">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">You're Offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            It looks like you're not connected to the internet. Some features may not be available.
          </p>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Available Offline:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• View cached tasks and events</li>
              <li>• Browse family dashboard</li>
              <li>• Access previously loaded content</li>
            </ul>
          </div>

          <Button onClick={handleRetry} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflinePage;