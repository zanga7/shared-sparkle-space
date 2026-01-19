import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppWindow, Image as ImageIcon, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function AppSettings() {
  const [appName, setAppName] = useState('Wild Ones Family App');
  const [shortName, setShortName] = useState('Family Dashboard');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Note: These settings are stored in index.html and manifest.json
    // They require a code change to update permanently
    toast.info('App name and icon settings require code deployment to take effect. Contact your developer to update index.html and manifest.json');
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">App Settings</h2>
        <p className="text-muted-foreground">Manage app name, icon, and branding</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* App Name Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AppWindow className="w-5 h-5" />
              App Name
            </CardTitle>
            <CardDescription>
              Configure the app name displayed in browser tabs and when installed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">Full App Name</Label>
              <Input 
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="My Family App"
              />
              <p className="text-xs text-muted-foreground">
                Used in browser tabs and meta tags
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">Short Name</Label>
              <Input 
                id="shortName"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="Family App"
              />
              <p className="text-xs text-muted-foreground">
                Used when installed as PWA on home screen
              </p>
            </div>
          </CardContent>
        </Card>

        {/* App Icon Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              App Icon
            </CardTitle>
            <CardDescription>
              The icon shown when the app is installed on devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center border border-border overflow-hidden">
                <img 
                  src="/icons/icon-192x192.png" 
                  alt="App Icon" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Current Icon</p>
                <p className="text-xs text-muted-foreground">192x192 and 512x512 variants</p>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                To change the app icon, replace the files at:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• <code className="bg-muted px-1 rounded">/public/icons/icon-192x192.png</code></li>
                <li>• <code className="bg-muted px-1 rounded">/public/icons/icon-512x512.png</code></li>
                <li>• <code className="bg-muted px-1 rounded">/public/favicon.ico</code></li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Current Configuration */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
            <CardDescription>
              These values are set in the codebase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Title (index.html)</p>
                <p className="font-medium">Wild Ones Family App</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">PWA Name (manifest.json)</p>
                <p className="font-medium">Family Dashboard</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Theme Color</p>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary"></div>
                  <p className="font-medium">#2563eb</p>
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Favicon</p>
                <p className="font-medium text-xs break-all">External GIF</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="font-medium text-sm">Fun family task and event management platform</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">PWA Display Mode</p>
                <p className="font-medium">Standalone</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <a href="https://realfavicongenerator.net/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Favicon Generator
          </a>
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
