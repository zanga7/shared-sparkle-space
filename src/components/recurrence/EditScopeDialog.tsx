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
}

export const EditScopeDialog = ({
  open,
  onOpenChange,
  onScopeSelect,
  itemType = 'event',
  occurrenceDate
}: EditScopeDialogProps) => {
  const [applyToOverrides, setApplyToOverrides] = useState(false);
  
  const handleScopeSelect = (scope: EditScope) => {
    onScopeSelect(scope, scope === 'all_occurrences' ? applyToOverrides : false);
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

          {/* This and following */}
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
                    <>Updates from {formatDate(occurrenceDate)} onward, past stays unchanged. </>
                  )}
                  Creates a new series starting from this occurrence.
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