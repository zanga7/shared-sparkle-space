import ScreenSaverSettings from '@/components/admin/ScreenSaverSettings';
import { PageHeading, SmallText } from '@/components/ui/typography';

export const ScreenSaverManagement = () => {
  return (
    <div className="page-padding component-spacing">
      <div className="section-spacing">
        <PageHeading>Screen Saver Management</PageHeading>
        <SmallText>
          Configure your family screen saver with photos from Google Photos or upload your own images.
        </SmallText>
      </div>
      
      <ScreenSaverSettings />
    </div>
  );
};
