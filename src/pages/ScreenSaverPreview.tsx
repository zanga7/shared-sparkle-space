import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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

export const ScreenSaverPreview = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ScreenSaverSettings | null>(null);
  const [images, setImages] = useState<ScreenSaverImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadSettings();
    loadImages();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (images.length > 0 && settings) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, settings.display_duration * 1000);

      return () => clearInterval(interval);
    }
  }, [images.length, settings?.display_duration]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.close();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const loadSettings = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user?.id)
        .single();

      if (profile) {
        const { data, error } = await supabase
          .from('screensaver_settings')
          .select('*')
          .eq('family_id', profile.family_id)
          .maybeSingle();

        if (data) {
          setSettings(data);
        } else {
          // Use default settings if none found
          setSettings({
            is_enabled: true,
            display_duration: 10,
            timeout_minutes: 5,
            transition_effect: 'fade',
            show_clock: true,
            show_weather: false,
            brightness: 75,
            google_photos_connected: false,
            custom_images_enabled: true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Fallback to default settings
      setSettings({
        is_enabled: true,
        display_duration: 10,
        timeout_minutes: 5,
        transition_effect: 'fade',
        show_clock: true,
        show_weather: false,
        brightness: 75,
        google_photos_connected: false,
        custom_images_enabled: true,
      });
    }
  };

  const loadImages = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user?.id)
        .single();

      if (profile) {
        const { data } = await supabase
          .from('screensaver_images')
          .select('*')
          .eq('family_id', profile.family_id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (data) {
          setImages(data);
        }
      }
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  if (!settings || images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-4">No Images Available</h2>
          <p className="text-muted-foreground">Upload some images to see the screen saver preview</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];
  const transitionClass = {
    fade: 'transition-opacity duration-1000 ease-in-out',
    slide: 'transition-transform duration-1000 ease-in-out',
    zoom: 'transition-all duration-1000 ease-in-out',
    dissolve: 'transition-all duration-2000 ease-in-out'
  }[settings.transition_effect] || 'transition-opacity duration-1000 ease-in-out';

  return (
    <div 
      className="fixed inset-0 bg-black overflow-hidden cursor-none"
      style={{ filter: `brightness(${settings.brightness}%)` }}
    >
      {/* Background Image */}
      <div className="relative w-full h-full">
        <div className="absolute inset-0">
          <img
            key={currentImageIndex}
            src={`${supabase.storage.from('screensaver-images').getPublicUrl(currentImage.file_path).data.publicUrl}`}
            alt={currentImage.name}
            className={`w-full h-full object-cover object-center ${transitionClass}`}
            style={{
              minWidth: '100vw',
              minHeight: '100vh',
            }}
          />
        </div>
        
        {/* Overlay Content */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        
        {/* Clock */}
        {settings.show_clock && (
          <div className="absolute top-8 right-8 text-white">
            <div className="text-6xl font-light">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xl text-white/80 text-center">
              {currentTime.toLocaleDateString([], { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        )}
        
        {/* Weather placeholder */}
        {settings.show_weather && (
          <div className="absolute bottom-8 left-8 text-white">
            <div className="text-2xl">72°F</div>
            <div className="text-sm text-white/80">Partly Cloudy</div>
          </div>
        )}
        
        {/* Exit hint */}
        <div className="absolute bottom-4 right-4 text-white/60 text-sm">
          Press ESC to exit preview
        </div>
      </div>
    </div>
  );
};