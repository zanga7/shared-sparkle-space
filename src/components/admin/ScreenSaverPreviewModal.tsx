import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ScreenSaverImage {
  id: string;
  name: string;
  file_path: string;
  is_active: boolean;
  sort_order: number;
}

interface ScreenSaverSettings {
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

interface ScreenSaverPreviewModalProps {
  open: boolean;
  onClose: () => void;
  settings: ScreenSaverSettings;
  images: ScreenSaverImage[];
}

export const ScreenSaverPreviewModal = ({ open, onClose, settings, images }: ScreenSaverPreviewModalProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open || images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, settings.display_duration * 1000);

    return () => clearInterval(interval);
  }, [open, images.length, settings.display_duration]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (images.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="text-center py-8">
            <p className="text-muted-foreground">No images available for preview.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please add some images or connect Google Photos first.
            </p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentImage = images[currentImageIndex];
  const imageUrl = supabase.storage.from('screensaver-images').getPublicUrl(currentImage.file_path).data.publicUrl;
  const transitionClass = settings.transition_effect === 'fade' ? 'transition-opacity duration-1000' : 
                          settings.transition_effect === 'slide' ? 'transition-transform duration-1000' : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-screen h-screen p-0 border-0 bg-black">
        <div 
          className="relative w-full h-full cursor-pointer"
          onClick={onClose}
          style={{ filter: `brightness(${settings.brightness}%)` }}
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              key={currentImage.id}
              src={imageUrl}
              alt={currentImage.name}
              className={`w-full h-full object-cover ${transitionClass}`}
            />
          </div>

          {/* Overlay Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-8 text-white pointer-events-none">
            {/* Close Button */}
            <div className="flex justify-end pointer-events-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Clock */}
            {settings.show_clock && (
              <div className="text-center">
                <div className="text-8xl font-light mb-2">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-2xl opacity-80">
                  {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
            )}

            {/* Weather */}
            {settings.show_weather && (
              <div className="text-center text-xl opacity-80">
                <p>Weather: Sunny, 72°F</p>
                <p className="text-sm mt-1">(Weather integration coming soon)</p>
              </div>
            )}

            {/* Image Info */}
            <div className="flex justify-between items-end">
              <div className="text-sm opacity-70">
                <p>{currentImage.name}</p>
              </div>
              <div className="text-sm opacity-70">
                <p>
                  {currentImageIndex + 1} / {images.length}
                </p>
                <p className="text-xs mt-1">Click anywhere or press ESC to close</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
