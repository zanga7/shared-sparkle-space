import { ScreenSaverSettings } from '@/components/admin/ScreenSaverSettings';

export const ScreenSaverManagement = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Screen Saver Management</h1>
        <p className="text-muted-foreground mt-2">
          Configure your family screen saver with photos from Google Photos or upload your own images.
        </p>
      </div>
      
      <ScreenSaverSettings />
    </div>
  );
};