import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Database, ArrowRight } from 'lucide-react';
import { useEventMigration } from '@/hooks/useEventMigration';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EventMigrationPanelProps {
  familyId?: string;
}

export const EventMigrationPanel = ({ familyId }: EventMigrationPanelProps) => {
  const [migrationStatus, setMigrationStatus] = useState({ needsMigration: false, count: 0 });
  const { migrating, migrationStats, migrateEventsToSeries, checkMigrationStatus } = useEventMigration(familyId);

  useEffect(() => {
    if (familyId) {
      checkMigrationStatus().then(setMigrationStatus);
    }
  }, [familyId, checkMigrationStatus]);

  const migrationProgress = migrationStats.total > 0 ? 
    Math.round(((migrationStats.migrated + migrationStats.errors) / migrationStats.total) * 100) : 0;

  if (!migrationStatus.needsMigration && !migrating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Event Migration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium">All events migrated</p>
            <p className="text-sm text-muted-foreground">
              Your events are using the new recurring series system
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Event Migration to Series System
          {migrationStatus.needsMigration && (
            <Badge variant="secondary">
              {migrationStatus.count} events need migration
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {migrationStatus.needsMigration && !migrating && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {migrationStatus.count} recurring events that need to be migrated to the new series system. 
              This will improve performance and enable better recurring event management.
            </AlertDescription>
          </Alert>
        )}

        {migrating && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Migration Progress</span>
              <span className="text-sm text-muted-foreground">
                {migrationStats.migrated + migrationStats.errors} / {migrationStats.total}
              </span>
            </div>
            <Progress value={migrationProgress} className="w-full" />
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">{migrationStats.migrated}</div>
                <div className="text-xs text-muted-foreground">Migrated</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">{migrationStats.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">{migrationStats.total - migrationStats.migrated - migrationStats.errors}</div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            What happens during migration:
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Recurring events are converted to event series</li>
            <li>• Original events are preserved and marked as migrated</li>
            <li>• Attendees and recurrence rules are transferred</li>
            <li>• Calendar display will show virtual instances</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={migrateEventsToSeries}
            disabled={migrating || !migrationStatus.needsMigration}
            className="flex-1"
          >
            {migrating ? 'Migrating...' : 'Start Migration'}
          </Button>
          <Button 
            variant="outline"
            onClick={() => checkMigrationStatus().then(setMigrationStatus)}
            disabled={migrating}
          >
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};