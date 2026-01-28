import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeading, SmallText } from '@/components/ui/typography';
import { AppWindow, Image as ImageIcon, Save, ExternalLink, Upload, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface IconSlot {
  key: 'icon_192_path' | 'icon_512_path' | 'apple_touch_icon_path' | 'favicon_path';
  label: string;
  description: string;
  recommendedSize: string;
  accept: string;
}

const ICON_SLOTS: IconSlot[] = [
  {
    key: 'icon_192_path',
    label: 'App Icon (192x192)',
    description: 'Standard PWA icon for Android devices',
    recommendedSize: '192x192 PNG',
    accept: 'image/png',
  },
  {
    key: 'icon_512_path',
    label: 'App Icon (512x512)',
    description: 'High-resolution PWA icon for splash screens',
    recommendedSize: '512x512 PNG',
    accept: 'image/png',
  },
  {
    key: 'apple_touch_icon_path',
    label: 'Apple Touch Icon',
    description: 'Icon displayed on iOS home screens',
    recommendedSize: '180x180 PNG',
    accept: 'image/png',
  },
  {
    key: 'favicon_path',
    label: 'Favicon',
    description: 'Browser tab icon (supports ICO, PNG, GIF)',
    recommendedSize: '32x32 or 64x64',
    accept: 'image/x-icon,image/png,image/gif',
  },
];

export default function AppSettings() {
  const queryClient = useQueryClient();
  const [appName, setAppName] = useState('Wild Ones Family App');
  const [shortName, setShortName] = useState('Family Dashboard');
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setAppName(settings.app_name);
      setShortName(settings.short_name);
    }
  }, [settings]);

  // Save name settings mutation
  const saveNamesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          app_name: appName, 
          short_name: shortName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('App names saved! Note: Changes to manifest.json and index.html require redeployment.');
    },
    onError: (error) => {
      console.error('Error saving names:', error);
      toast.error('Failed to save app names');
    },
  });

  // Get public URL for an icon
  const getIconUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from('app-icons').getPublicUrl(path);
    return data.publicUrl;
  };

  // Handle icon upload
  const handleUpload = async (slot: IconSlot, file: File) => {
    setUploadingSlot(slot.key);
    
    try {
      // Validate file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }

      // Create filename based on slot
      const fileExt = file.name.split('.').pop();
      const fileName = `${slot.key.replace(/_path$/, '')}.${fileExt}`;

      // Delete old file if exists
      const oldPath = settings?.[slot.key];
      if (oldPath) {
        await supabase.storage.from('app-icons').remove([oldPath]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('app-icons')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update database
      const { error: dbError } = await supabase
        .from('app_settings')
        .update({ 
          [slot.key]: fileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success(`${slot.label} uploaded successfully`);
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast.error(`Failed to upload ${slot.label}`);
    } finally {
      setUploadingSlot(null);
    }
  };

  // Handle icon delete
  const handleDelete = async (slot: IconSlot) => {
    const path = settings?.[slot.key];
    if (!path) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('app-icons')
        .remove([path]);

      if (storageError) throw storageError;

      // Update database
      const { error: dbError } = await supabase
        .from('app_settings')
        .update({ 
          [slot.key]: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success(`${slot.label} removed`);
    } catch (error) {
      console.error('Error deleting icon:', error);
      toast.error(`Failed to remove ${slot.label}`);
    }
  };

  const handleFileChange = (slot: IconSlot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(slot, file);
    }
    // Reset input
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-padding component-spacing">
      <div className="section-spacing">
        <PageHeading>App Settings</PageHeading>
        <SmallText>Manage app name, icon, and branding</SmallText>
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
            <Button 
              onClick={() => saveNamesMutation.mutate()} 
              disabled={saveNamesMutation.isPending}
              className="w-full"
            >
              {saveNamesMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Names
            </Button>
          </CardContent>
        </Card>

        {/* PWA Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Important Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Icons uploaded here are stored in the database and can be used for dynamic PWA configuration. 
              However, for best browser compatibility:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Icons in <code className="bg-muted px-1 rounded">/public/icons/</code> are used by the static manifest</li>
              <li>Changes to app name require updating <code className="bg-muted px-1 rounded">manifest.json</code> and <code className="bg-muted px-1 rounded">index.html</code></li>
              <li>For production, replace the static files with your uploaded icons</li>
            </ul>
            <Button variant="outline" size="sm" asChild className="w-full">
              <a href="https://realfavicongenerator.net/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Favicon Generator Tool
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* App Icons Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            App Icons
          </CardTitle>
          <CardDescription>
            Upload icons for different platforms and sizes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ICON_SLOTS.map((slot) => {
              const currentPath = settings?.[slot.key];
              const iconUrl = getIconUrl(currentPath);
              const isUploading = uploadingSlot === slot.key;

              return (
                <div key={slot.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{slot.label}</h4>
                      <p className="text-xs text-muted-foreground">{slot.recommendedSize}</p>
                    </div>
                    {currentPath && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="aspect-square w-full max-w-[120px] mx-auto rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center overflow-hidden">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : iconUrl ? (
                      <img 
                        src={iconUrl} 
                        alt={slot.label}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {slot.description}
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={(el) => fileInputRefs.current[slot.key] = el}
                      onChange={handleFileChange(slot)}
                      accept={slot.accept}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => fileInputRefs.current[slot.key]?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Upload
                    </Button>
                    {currentPath && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(slot)}
                        disabled={isUploading}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Static Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Static Configuration (in codebase)</CardTitle>
          <CardDescription>
            These values are currently set in the static files
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
              <p className="text-xs text-muted-foreground mb-1">PWA Display Mode</p>
              <p className="font-medium">Standalone</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="font-medium text-sm">Fun family task and event management platform</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
              <p className="font-medium text-sm">
                {settings?.updated_at 
                  ? new Date(settings.updated_at).toLocaleDateString()
                  : 'Never'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
