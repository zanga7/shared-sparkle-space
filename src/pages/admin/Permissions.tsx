import { MemberPermissions } from '@/components/admin/MemberPermissions';
import { DashboardModeSettings } from '@/components/admin/DashboardModeSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Permissions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Permissions & Dashboard Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure dashboard mode, access controls, and member permissions
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard Settings</TabsTrigger>
          <TabsTrigger value="members">Member Permissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <DashboardModeSettings />
        </TabsContent>
        
        <TabsContent value="members" className="space-y-6 mt-6">
          <MemberPermissions />
        </TabsContent>
      </Tabs>
    </div>
  );
}