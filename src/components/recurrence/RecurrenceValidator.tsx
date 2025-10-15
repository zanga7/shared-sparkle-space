import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { RecurrenceRule } from '@/types/recurrence';
import { toRRULE, validateRRULE, getRRULESummary } from '@/utils/rruleConverter';
import { generateInstances } from '@/utils/rruleInstanceGenerator';

interface RecurrenceValidatorProps {
  rule: RecurrenceRule;
  startDate: Date;
  showDetails?: boolean;
}

export const RecurrenceValidator = ({ 
  rule, 
  startDate, 
  showDetails = false 
}: RecurrenceValidatorProps) => {
  const [validationResults, setValidationResults] = useState({
    rruleGeneration: { success: false, error: '' },
    rruleValidation: { valid: false, error: '' as string | undefined },
    instanceGeneration: { success: false, count: 0, error: '' },
    summary: ''
  });

  useEffect(() => {
    const validate = () => {
      const results = {
        rruleGeneration: { success: false, error: '' },
        rruleValidation: { valid: false, error: '' as string | undefined },
        instanceGeneration: { success: false, count: 0, error: '' },
        summary: ''
      };

      // Test 1: RRULE Generation
      try {
        const rrule = toRRULE(rule, startDate);
        results.rruleGeneration.success = true;

        // Test 2: RRULE Validation
        const validation = validateRRULE(rrule);
        results.rruleValidation = {
          valid: validation.valid,
          error: validation.error || ''
        };

        if (validation.valid) {
          // Test 3: Generate Summary
          try {
            results.summary = getRRULESummary(rrule);
          } catch (err) {
            results.summary = 'Failed to generate summary';
          }

          // Test 4: Instance Generation
          try {
            const instances = generateInstances({
              recurrenceRule: rule,
              startDate: startDate,
              endDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
              exceptions: []
            });
            results.instanceGeneration.success = true;
            results.instanceGeneration.count = instances.length;
          } catch (err) {
            results.instanceGeneration.error = err instanceof Error ? err.message : 'Unknown error';
          }
        }
      } catch (err) {
        results.rruleGeneration.error = err instanceof Error ? err.message : 'Unknown error';
      }

      setValidationResults(results);
    };

    validate();
  }, [rule, startDate]);

  if (!showDetails) {
    const allSuccess = validationResults.rruleGeneration.success && 
                      validationResults.rruleValidation.valid && 
                      validationResults.instanceGeneration.success;

    return (
      <Badge variant={allSuccess ? "outline" : "destructive"} className="gap-1.5">
        {allSuccess ? (
          <>
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span className="text-xs">Valid</span>
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3" />
            <span className="text-xs">Invalid</span>
          </>
        )}
      </Badge>
    );
  }

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Recurrence Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* RRULE Generation */}
        <div className="flex items-start gap-2">
          {validationResults.rruleGeneration.success ? (
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">RRULE Generation</p>
            {!validationResults.rruleGeneration.success && (
              <p className="text-xs text-destructive">{validationResults.rruleGeneration.error}</p>
            )}
          </div>
        </div>

        {/* RRULE Validation */}
        <div className="flex items-start gap-2">
          {validationResults.rruleValidation.valid ? (
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">RRULE Validation (RFC 5545)</p>
            {!validationResults.rruleValidation.valid && (
              <p className="text-xs text-destructive">{validationResults.rruleValidation.error}</p>
            )}
          </div>
        </div>

        {/* Instance Generation */}
        <div className="flex items-start gap-2">
          {validationResults.instanceGeneration.success ? (
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">Instance Generation</p>
            {validationResults.instanceGeneration.success ? (
              <p className="text-xs text-muted-foreground">
                {validationResults.instanceGeneration.count} instances in next year
              </p>
            ) : (
              <p className="text-xs text-destructive">{validationResults.instanceGeneration.error}</p>
            )}
          </div>
        </div>

        {/* Summary */}
        {validationResults.summary && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">Summary: {validationResults.summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
