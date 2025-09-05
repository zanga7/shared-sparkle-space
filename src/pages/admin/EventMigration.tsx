import { EventMigrationPanel } from '@/components/admin/EventMigrationPanel';
import { useAdminContext } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function EventMigration() {
  const { profile } = useAdminContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Event Migration</h1>
        <p className="text-muted-foreground mt-1">
          Migrate recurring events to the new series system for better performance and management
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>New Recurring Events System:</strong> We've upgraded to a new series-based system for 
          recurring events that provides better performance, more flexible editing options, and improved 
          calendar display. Your existing recurring events need to be migrated to take advantage of these improvements.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Improvements
            </CardTitle>
            <CardDescription>
              Benefits of the new recurring events system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Better Performance</div>
                  <div className="text-sm text-muted-foreground">
                    Virtual instances generated on-demand instead of storing individual events
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Flexible Editing</div>
                  <div className="text-sm text-muted-foreground">
                    Edit single occurrences, future events, or entire series
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Exception Handling</div>
                  <div className="text-sm text-muted-foreground">
                    Skip specific occurrences or override with custom data
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-orange-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Series Management</div>
                  <div className="text-sm text-muted-foreground">
                    Split series for different rules on future events
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <EventMigrationPanel familyId={profile?.family_id} />
      </div>
    </div>
  );
}