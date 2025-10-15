import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { getRRULESummary } from '@/utils/rruleConverter';

interface RRuleDisplayProps {
  rrule: string;
  showCopyButton?: boolean;
}

export const RRuleDisplay = ({ rrule, showCopyButton = true }: RRuleDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rrule);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy RRULE:', err);
    }
  };

  // Get human-readable summary
  const summary = getRRULESummary(rrule);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <CalendarCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Calendar-compatible recurrence:
              </p>
              <p className="text-sm font-medium break-words">{summary}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            RFC 5545
          </Badge>
        </div>

        {showCopyButton && (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-2 py-1 rounded overflow-x-auto">
              {rrule}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 flex-shrink-0"
            >
              {copied ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
