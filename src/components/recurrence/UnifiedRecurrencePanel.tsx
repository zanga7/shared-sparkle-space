import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Repeat, Settings } from 'lucide-react';
import { 
  RecurrencePreset, 
  RecurrenceRule, 
  TaskRecurrenceOptions, 
  EventRecurrenceOptions,
  RecurrencePreview as RecurrencePreviewType
} from '@/types/recurrence';
import { Profile } from '@/types/task';
import { RecurrencePresets } from './RecurrencePresets';
import { RecurrenceEnds } from './RecurrenceEnds';
import { RecurrencePreview } from './RecurrencePreview';
import { CustomRecurrenceBuilder } from './CustomRecurrenceBuilder';
import { TaskRecurrenceOptionsComponent } from './TaskRecurrenceOptions';
import { 
  createRuleFromPreset, 
  generateRecurrencePreview, 
  validateRecurrenceRule 
} from '@/utils/recurrenceUtils';

interface UnifiedRecurrencePanelProps {
  // Common props
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  startDate: Date;
  startTime?: string;
  
  // Type-specific props
  type: 'task' | 'event';
  taskOptions?: TaskRecurrenceOptions;
  eventOptions?: EventRecurrenceOptions;
  onTaskOptionsChange?: (options: TaskRecurrenceOptions) => void;
  onEventOptionsChange?: (options: EventRecurrenceOptions) => void;
  
  // For task rotation
  familyMembers?: Profile[];
  selectedAssignees?: string[];
}

export const UnifiedRecurrencePanel = ({
  enabled,
  onEnabledChange,
  startDate,
  startTime,
  type,
  taskOptions,
  eventOptions,
  onTaskOptionsChange,
  onEventOptionsChange,
  familyMembers = [],
  selectedAssignees = []
}: UnifiedRecurrencePanelProps) => {
  
  const [selectedPreset, setSelectedPreset] = useState<RecurrencePreset>('every_day');
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  
  // Initialize currentRule from existing options or create default
  const [currentRule, setCurrentRule] = useState<RecurrenceRule>(() => {
    // Check if we have existing recurrence options
    const existingRule = (type === 'task' ? taskOptions?.rule : eventOptions?.rule);
    if (existingRule) {
      console.log('Using existing recurrence rule:', existingRule);
      return existingRule;
    }
    console.log('Creating default recurrence rule');
    return createRuleFromPreset('every_day', startDate);
  });

  // Generate preview whenever rule changes
  const [preview, setPreview] = useState<RecurrencePreviewType>(() => 
    generateRecurrencePreview(startDate, currentRule, taskOptions, eventOptions)
  );

  // Sync with external options changes (when editing existing events)
  useEffect(() => {
    const existingRule = (type === 'task' ? taskOptions?.rule : eventOptions?.rule);
    if (existingRule && JSON.stringify(existingRule) !== JSON.stringify(currentRule)) {
      console.log('Syncing with external rule change:', existingRule);
      setCurrentRule(existingRule);
    }
  }, [taskOptions?.rule, eventOptions?.rule, type, currentRule]);

  // Update preview when inputs change
  useEffect(() => {
    const newPreview = generateRecurrencePreview(startDate, currentRule, taskOptions, eventOptions);
    setPreview(newPreview);
  }, [startDate, currentRule, taskOptions, eventOptions]);

  // Handle preset change
  const handlePresetChange = (preset: RecurrencePreset) => {
    setSelectedPreset(preset);
    
    if (preset === 'custom') {
      setShowCustomBuilder(true);
    } else {
      setShowCustomBuilder(false);
      const newRule = createRuleFromPreset(preset, startDate);
      setCurrentRule(newRule);
      updateOptionsWithRule(newRule);
    }
  };

  // Update the appropriate options object with new rule
  const updateOptionsWithRule = (rule: RecurrenceRule) => {
    if (type === 'task' && taskOptions && onTaskOptionsChange) {
      onTaskOptionsChange({
        ...taskOptions,
        rule
      });
    } else if (type === 'event' && eventOptions && onEventOptionsChange) {
      onEventOptionsChange({
        ...eventOptions,
        rule
      });
    }
  };

  // Handle custom rule changes
  const handleRuleChange = (rule: RecurrenceRule) => {
    setCurrentRule(rule);
    updateOptionsWithRule(rule);
  };

  // Handle end type changes
  const handleEndTypeChange = (endType: RecurrenceRule['endType']) => {
    const newRule = { ...currentRule, endType };
    setCurrentRule(newRule);
    updateOptionsWithRule(newRule);
  };

  const handleEndDateChange = (endDate: Date | undefined) => {
    const newRule = { 
      ...currentRule, 
      endDate: endDate?.toISOString(),
      endType: 'on_date' as const
    };
    setCurrentRule(newRule);
    updateOptionsWithRule(newRule);
  };

  const handleEndCountChange = (endCount: number) => {
    const newRule = { 
      ...currentRule, 
      endCount,
      endType: 'after_count' as const
    };
    setCurrentRule(newRule);
    updateOptionsWithRule(newRule);
  };

  // Handle task-specific options changes
  const handleTaskOptionsChange = (newTaskOptions: TaskRecurrenceOptions) => {
    if (onTaskOptionsChange) {
      onTaskOptionsChange(newTaskOptions);
    }
  };

  // Validation
  const validationErrors = validateRecurrenceRule(currentRule);
  const hasErrors = validationErrors.length > 0;

  if (!enabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="repeat-switch" className="text-sm font-medium">Repeat this</Label>
          </div>
          <Switch
            id="repeat-switch"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Repeat Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          <Label htmlFor="repeat-switch" className="text-sm font-medium">Repeat this</Label>
        </div>
        <Switch
          id="repeat-switch"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-4">
          
          {/* Presets */}
          <RecurrencePresets
            selectedPreset={selectedPreset}
            onPresetChange={handlePresetChange}
            selectedDate={startDate}
          />

          <Separator />

          {/* Ends */}
          <RecurrenceEnds
            endType={currentRule.endType}
            endDate={currentRule.endDate ? new Date(currentRule.endDate) : undefined}
            endCount={currentRule.endCount}
            onEndTypeChange={handleEndTypeChange}
            onEndDateChange={handleEndDateChange}
            onEndCountChange={handleEndCountChange}
          />

          {/* Custom Builder */}
          {selectedPreset === 'custom' && (
            <>
              <Separator />
              <CustomRecurrenceBuilder
                rule={currentRule}
                onRuleChange={handleRuleChange}
              />
            </>
          )}

          {/* Task-specific Options */}
          {type === 'task' && taskOptions && (
            <>
              <Separator />
              <TaskRecurrenceOptionsComponent
                options={taskOptions}
                onOptionsChange={handleTaskOptionsChange}
                familyMembers={familyMembers}
                selectedAssignees={selectedAssignees}
              />
            </>
          )}

          <Separator />

          {/* Preview */}
          <RecurrencePreview preview={preview} />

          {/* Validation Errors */}
          {hasErrors && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-1">Please fix these issues:</p>
              <ul className="text-sm text-destructive space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};