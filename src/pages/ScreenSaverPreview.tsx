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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSettings();
      loadImages();
    }
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

  // Add ESC key listener to close preview
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
        const { data } = await supabase
          .from('screensaver_settings')
          .select('*')
          .eq('family_id', profile.family_id)
          .single();

        if (data) {
          setSettings(data);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
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

        console.log('Loaded images:', data); // Debug log
        if (data) {
          setImages(data);
        }
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading screen saver...</p>
        </div>
      </div>
    );
  }

  if (!settings || images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-4">No Images Available</h2>
          <p className="text-muted-foreground mb-4">Upload some images in the admin panel to see the screen saver preview</p>
          <p className="text-sm text-gray-400">Press ESC or click to close</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];
  const transitionClass = {
    fade: 'transition-opacity duration-1000',
    slide: 'transition-transform duration-1000', 
    zoom: 'transition-all duration-1000',
    dissolve: 'transition-all duration-2000'
  }[settings.transition_effect] || 'transition-opacity duration-1000';

  return (
    <div 
      className="fixed inset-0 bg-black overflow-hidden cursor-pointer"
      style={{ filter: `brightness(${settings.brightness}%)` }}
      onClick={() => window.close()}
    >
      {/* Background Image - Full screen cover */}
      <div className="absolute inset-0">
        <img
          key={currentImageIndex}
          src={`${supabase.storage.from('screensaver-images').getPublicUrl(currentImage.file_path).data.publicUrl}`}
          alt={currentImage.name}
          className={`absolute inset-0 w-full h-full ${transitionClass}`}
          style={{ 
            objectFit: 'cover',
            objectPosition: 'center'
          }}
          onError={(e) => {
            console.error('Image failed to load:', currentImage.file_path);
            console.log('Image URL:', e.currentTarget.src);
          }}
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30" />
        
        {/* Clock */}
        {settings.show_clock && (
          <div className="absolute top-8 right-8 text-white text-right">
            <div className="text-6xl font-light tracking-wide">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xl text-white/80 mt-2">
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
            <div className="text-3xl font-light">72°F</div>
            <div className="text-lg text-white/80">Partly Cloudy</div>
          </div>
        )}
        
        {/* Image counter and controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm text-center">
          <div className="mb-2">
            {currentImageIndex + 1} of {images.length} • {currentImage.name}
          </div>
          <div>Press ESC or click anywhere to exit preview</div>
        </div>
      </div>
    </div>
  );
};