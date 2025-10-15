import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { RecurrencePreview as RecurrencePreviewType } from '@/types/recurrence';
import { RRuleDisplay } from './RRuleDisplay';

interface RecurrencePreviewProps {
  preview: RecurrencePreviewType;
  rrule?: string;
  showRRule?: boolean;
}

export const RecurrencePreview = ({ preview, rrule, showRRule = true }: RecurrencePreviewProps) => {
  return (
    <div className="space-y-3">
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="p-4 space-y-3">
          {/* Summary */}
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Repeats:</p>
              <p className="text-sm text-muted-foreground">{preview.summary}</p>
            </div>
          </div>

          {/* Next occurrences */}
          {preview.nextOccurrences.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Next 3 occurrences:</p>
              <div className="flex flex-wrap gap-1">
                {preview.nextOccurrences.slice(0, 3).map((date, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {format(date, 'MMM d, yyyy')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="space-y-1">
              {preview.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 text-amber-600">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">{warning}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RRULE Display */}
      {showRRule && rrule && (
        <RRuleDisplay rrule={rrule} />
      )}
    </div>
  );
};