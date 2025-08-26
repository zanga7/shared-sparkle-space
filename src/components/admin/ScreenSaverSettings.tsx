import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  Clock, 
  Cloud, 
  Sun, 
  Upload, 
  Trash2,
  ExternalLink,
  Settings,
  Image as ImageIcon,
  Sparkles,
  Play,
  Timer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Profile } from '@/types/task';

interface ScreenSaverImage {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface ScreenSaverSettings {
  id?: string;
  is_enabled: boolean;
  display_duration: number;
  timeout_minutes: number;
  transition_effect: string;
  show_clock: boolean;
  show_weather: boolean;
  brightness: number;
  google_photos_connected: boolean;
  google_photos_album_id?: string;
  custom_images_enabled: boolean;
}

interface GooglePhotosAlbum {
  id: string;
  title: string;
  mediaItemsCount: string;
  coverPhotoBaseUrl?: string;
}

export const ScreenSaverSettings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<ScreenSaverSettings>({
    is_enabled: true,
    display_duration: 30,
    timeout_minutes: 5,
    transition_effect: 'fade',
    show_clock: true,
    show_weather: false,
    brightness: 75,
    google_photos_connected: false,
    custom_images_enabled: true,
  });
  const [images, setImages] = useState<ScreenSaverImage[]>([]);
  const [googleAlbums, setGoogleAlbums] = useState<GooglePhotosAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile?.family_id) {
      loadSettings();
      loadImages();
    }
  }, [profile?.family_id]);

  const fetchUserProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        return;
      }

      setProfile(profileData);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user profile',
        variant: 'destructive',
      });
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('screensaver_settings')
        .select('*')
        .eq('family_id', profile?.family_id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          is_enabled: data.is_enabled,
          display_duration: data.display_duration,
          timeout_minutes: data.timeout_minutes || 5,
          transition_effect: data.transition_effect,
          show_clock: data.show_clock,
          show_weather: data.show_weather,
          brightness: data.brightness,
          google_photos_connected: data.google_photos_connected,
          google_photos_album_id: data.google_photos_album_id,
          custom_images_enabled: data.custom_images_enabled,
        });

        // Load Google Photos albums if connected
        if (data.google_photos_connected) {
          loadGoogleAlbums();
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load screen saver settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async () => {
    try {
      const { data, error } = await supabase
        .from('screensaver_images')
        .select('*')
        .eq('family_id', profile?.family_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  const loadGoogleAlbums = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-photos-auth', {
        body: {
          action: 'get_albums',
          family_id: profile?.family_id,
        },
      });

      if (error) throw error;
      setGoogleAlbums(data.albums || []);
    } catch (error) {
      console.error('Error loading Google albums:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Google Photos albums',
        variant: 'destructive',
      });
    }
  };

  const saveSettings = async () => {
    try {
      const settingsData = {
        family_id: profile?.family_id,
        is_enabled: settings.is_enabled,
        display_duration: settings.display_duration,
        timeout_minutes: settings.timeout_minutes,
        transition_effect: settings.transition_effect,
        show_clock: settings.show_clock,
        show_weather: settings.show_weather,
        brightness: settings.brightness,
        google_photos_connected: settings.google_photos_connected,
        google_photos_album_id: settings.google_photos_album_id,
        custom_images_enabled: settings.custom_images_enabled,
        created_by: profile?.id,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('screensaver_settings')
          .update(settingsData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('screensaver_settings')
          .insert([settingsData])
          .select()
          .single();
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: 'Success',
        description: 'Screen saver settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  const connectGooglePhotos = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-photos-auth', {
        body: {
          action: 'get_auth_url',
          family_id: profile?.family_id,
        },
      });

      if (error) throw error;
      
      // Open Google OAuth in new window
      window.open(data.auth_url, '_blank', 'width=600,height=600');
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        const { data: integration } = await supabase
          .from('google_photos_integrations')
          .select('id')
          .eq('family_id', profile?.family_id)
          .eq('is_active', true)
          .single();

        if (integration) {
          clearInterval(pollInterval);
          setSettings(prev => ({ ...prev, google_photos_connected: true }));
          loadGoogleAlbums();
          toast({
            title: 'Success',
            description: 'Google Photos connected successfully',
          });
          setConnecting(false);
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnecting(false);
      }, 120000);

    } catch (error) {
      console.error('Error connecting Google Photos:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect Google Photos',
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: 'Error',
            description: `File ${file.name} is too large. Maximum size is 10MB.`,
            variant: 'destructive',
          });
          continue;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: 'Error',
            description: `File ${file.name} is not an image.`,
            variant: 'destructive',
          });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${profile?.family_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('screensaver-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Add to database
        const { error: dbError } = await supabase
          .from('screensaver_images')
          .insert([{
            family_id: profile?.family_id,
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: profile?.id,
            sort_order: images.length,
          }]);

        if (dbError) throw dbError;

        toast({
          title: 'Success',
          description: `${file.name} uploaded successfully`,
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: 'Error',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
      }
    }

    loadImages();
    // Reset input
    event.target.value = '';
  };

  const handleImageUpload = async (file: File) => {
    // This function is replaced by handleFileSelect above
  };

  const deleteImage = async (imageId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('screensaver-images')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('screensaver_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      loadImages();
      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Screen Saver Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enable Screen Saver</Label>
                <p className="text-sm text-muted-foreground">
                  Turn on the family screen saver
                </p>
              </div>
              <Switch
                id="enabled"
                checked={settings.is_enabled}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, is_enabled: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Display Duration (seconds)</Label>
              <div className="px-3">
                <Slider
                  value={[settings.display_duration]}
                  onValueChange={([value]) =>
                    setSettings(prev => ({ ...prev, display_duration: value }))
                  }
                  max={120}
                  min={5}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>5s</span>
                  <span>{settings.display_duration}s</span>
                  <span>120s</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Screen Saver Timeout (minutes)</Label>
              <div className="px-3">
                <Slider
                  value={[settings.timeout_minutes]}
                  onValueChange={([value]) =>
                    setSettings(prev => ({ ...prev, timeout_minutes: value }))
                  }
                  max={60}
                  min={2}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>2min</span>
                  <span>{settings.timeout_minutes}min</span>
                  <span>60min</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Transition Effect</Label>
              <Select
                value={settings.transition_effect}
                onValueChange={(value) =>
                  setSettings(prev => ({ ...prev, transition_effect: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="dissolve">Dissolve</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Brightness (%)</Label>
              <div className="px-3">
                <Slider
                  value={[settings.brightness]}
                  onValueChange={([value]) =>
                    setSettings(prev => ({ ...prev, brightness: value }))
                  }
                  max={100}
                  min={10}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>10%</span>
                  <span>{settings.brightness}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="clock">Show Clock</Label>
                <p className="text-sm text-muted-foreground">
                  Display current time on screen saver
                </p>
              </div>
              <Switch
                id="clock"
                checked={settings.show_clock}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, show_clock: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weather">Show Weather</Label>
                <p className="text-sm text-muted-foreground">
                  Display weather information
                </p>
              </div>
              <Switch
                id="weather"
                checked={settings.show_weather}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, show_weather: checked }))
                }
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={saveSettings} className="flex-1">
              <Settings className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
            <Button variant="outline" onClick={() => window.open('/screensaver-preview', '_blank', 'fullscreen=yes')}>
              <Play className="h-4 w-4 mr-2" />
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Google Photos Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Google Photos Integration
            {settings.google_photos_connected && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                Connected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings.google_photos_connected ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Connect your Google Photos account to automatically display your family photos
              </p>
              <Button 
                onClick={connectGooglePhotos} 
                disabled={connecting}
                className="w-full"
              >
                {connecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Google Photos
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600 text-sm font-medium">
                ✓ Google Photos connected successfully
              </p>
              
              {googleAlbums.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Album</Label>
                  <Select
                    value={settings.google_photos_album_id || ''}
                    onValueChange={(value) =>
                      setSettings(prev => ({ ...prev, google_photos_album_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an album" />
                    </SelectTrigger>
                    <SelectContent>
                      {googleAlbums.map((album) => (
                        <SelectItem key={album.id} value={album.id}>
                          {album.title} ({album.mediaItemsCount} photos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Custom Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="custom-images">Enable Custom Images</Label>
              <p className="text-sm text-muted-foreground">
                Use uploaded images in screen saver
              </p>
            </div>
            <Switch
              id="custom-images"
              checked={settings.custom_images_enabled}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, custom_images_enabled: checked }))
              }
            />
          </div>

          {settings.custom_images_enabled && (
            <>
              <div className="space-y-2">
                <Label>Upload Images</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag & drop images here or click to browse
                  </p>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="max-w-xs mx-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    PNG, JPG, GIF up to 10MB each
                  </p>
                </div>
              </div>

              {images.length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Uploaded Images ({images.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {images.map((image) => (
                        <div key={image.id} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                            <img
                              src={`${supabase.storage.from('screensaver-images').getPublicUrl(image.file_path).data.publicUrl}`}
                              alt={image.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteImage(image.id, image.file_path)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {image.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};