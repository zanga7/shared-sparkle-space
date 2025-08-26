import { MemberPermissions } from '@/components/admin/MemberPermissions';

export default function Permissions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Member Permissions</h1>
        <p className="text-muted-foreground mt-1">
          Configure PIN requirements and permissions for each family member
        </p>
      </div>
      
      <MemberPermissions />
    </div>
  );
}