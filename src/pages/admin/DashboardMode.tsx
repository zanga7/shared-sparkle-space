import { DashboardModeSettings } from '@/components/admin/DashboardModeSettings';

export default function DashboardMode() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard Mode Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure shared device access and member identity switching
        </p>
      </div>
      
      <DashboardModeSettings />
    </div>
  );
}