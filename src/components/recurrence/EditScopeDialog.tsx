import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export type EditScope = 'this_only' | 'this_and_following' | 'all_occurrences';

interface EditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScopeSelect: (scope: EditScope, applyToOverrides?: boolean) => void;
  itemType?: 'event' | 'task';
  occurrenceDate?: Date;
  futureOverrideCount?: number; // NEW: Show warning if future overrides exist
}

export const EditScopeDialog = ({
  open,
  onOpenChange,
  onScopeSelect,
  itemType = 'event',
  occurrenceDate,
  futureOverrideCount = 0
}: EditScopeDialogProps) => {
  const [applyToOverrides, setApplyToOverrides] = useState(false);
  
  const handleScopeSelect = (scope: EditScope) => {
    // For "This and following", always update future overrides (no checkbox)
    const shouldApplyToOverrides = scope === 'this_and_following' ? true : 
                                   scope === 'all_occurrences' ? applyToOverrides : false;
    
    onScopeSelect(scope, shouldApplyToOverrides);
    onOpenChange(false);
    setApplyToOverrides(false); // Reset for next time
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change repeating {itemType}</DialogTitle>
          <DialogDescription>
            How would you like to apply your changes?
          </DialogDescription>
        </DialogHeader>

        {/* Smart warning for future overrides */}
        {futureOverrideCount > 0 && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 mb-2">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{futureOverrideCount}</strong> future {futureOverrideCount === 1 ? 'date has' : 'dates have'} custom changes that will be updated
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">

          {/* This occurrence only */}
          <Button
            variant="outline"
            className="w-full justify-start text-left h-auto p-4 hover:bg-muted/50"
            onClick={() => handleScopeSelect('this_only')}
          >
            <div className="flex items-start gap-3 w-full">
              <Calendar className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-base">This occurrence only</div>
                <div className="text-sm text-muted-foreground">
                  {occurrenceDate && (
                    <>Change just {formatDate(occurrenceDate)}. </>
                  )}
                  Only this instance will be modified, all other occurrences stay unchanged.
                </div>
              </div>
            </div>
          </Button>

          {/* This and following - UPDATED description */}
          <Button
            variant="outline"
            className="w-full justify-start text-left h-auto p-4 hover:bg-muted/50"
            onClick={() => handleScopeSelect('this_and_following')}
          >
            <div className="flex items-start gap-3 w-full">
              <CalendarRange className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-base">This and following</div>
                <div className="text-sm text-muted-foreground">
                  {occurrenceDate && (
                    <>Updates from {formatDate(occurrenceDate)} onward. </>
                  )}
                  All future dates will be updated, including previously modified ones.
                </div>
              </div>
            </div>
          </Button>

          {/* All occurrences */}
          <Button
            variant="outline"
            className="w-full justify-start text-left h-auto p-4 hover:bg-muted/50"
            onClick={() => handleScopeSelect('all_occurrences')}
          >
            <div className="flex items-start gap-3 w-full">
              <CalendarDays className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-base">All occurrences</div>
                <div className="text-sm text-muted-foreground">
                  Updates the entire series. You can also apply these changes to previously modified dates.
                </div>
              </div>
            </div>
          </Button>

          {/* Cascade option for "All occurrences" */}
          <div className="flex items-start space-x-3 pl-6 pb-2">
            <Checkbox
              id="apply-to-overrides"
              checked={applyToOverrides}
              onCheckedChange={(checked) => setApplyToOverrides(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="apply-to-overrides"
                className="text-sm font-normal cursor-pointer"
              >
                Also apply to previously modified dates
              </Label>
              <p className="text-xs text-muted-foreground">
                Updates fields you changed (like title) on dates you previously edited individually
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};