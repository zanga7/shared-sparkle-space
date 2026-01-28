import { MemberPermissions } from '@/components/admin/MemberPermissions';
import { DashboardModeSettings } from '@/components/admin/DashboardModeSettings';
import { PWAInstallSettings } from '@/components/admin/PWAInstallSettings';
import { PageHeading, SmallText } from '@/components/ui/typography';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Permissions() {
  return (
    <div className="page-padding component-spacing">
      <div className="section-spacing">
        <PageHeading>Permissions & Dashboard Settings</PageHeading>
        <SmallText>
          Configure dashboard mode, access controls, member permissions, and app installation
        </SmallText>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="app">App Install</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <DashboardModeSettings />
        </TabsContent>
        
        <TabsContent value="members" className="space-y-6 mt-6">
          <MemberPermissions />
        </TabsContent>

        <TabsContent value="app" className="space-y-6 mt-6">
          <PWAInstallSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
