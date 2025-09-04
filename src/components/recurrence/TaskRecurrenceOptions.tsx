import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, RotateCcw, Users, Calendar, GraduationCap } from 'lucide-react';
import { TaskRecurrenceOptions } from '@/types/recurrence';
import { Profile } from '@/types/task';

interface TaskRecurrenceOptionsProps {
  options: TaskRecurrenceOptions;
  onOptionsChange: (options: TaskRecurrenceOptions) => void;
  familyMembers: Profile[];
  selectedAssignees: string[];
}

export const TaskRecurrenceOptionsComponent = ({ 
  options, 
  onOptionsChange, 
  familyMembers,
  selectedAssignees
}: TaskRecurrenceOptionsProps) => {
  
  const updateOptions = (updates: Partial<TaskRecurrenceOptions>) => {
    onOptionsChange({ ...options, ...updates });
  };

  // Filter family members to only include those who are assigned
  const assignedMembers = familyMembers.filter(member => 
    selectedAssignees.includes(member.id)
  );

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Task-specific Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Repeat From */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Repeat from</Label>
            <div className="group relative">
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-black text-white rounded whitespace-nowrap z-10">
                Completion date keeps habits moving forward when done late
              </div>
            </div>
          </div>
          
          <RadioGroup 
            value={options.repeatFrom} 
            onValueChange={(value: 'scheduled' | 'completion') => updateOptions({ repeatFrom: value })}
            className="grid grid-cols-2 gap-3"
          >
            <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-background cursor-pointer">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <div className="flex-1">
                <Label htmlFor="scheduled" className="cursor-pointer flex items-center gap-2 font-medium text-sm">
                  <Calendar className="h-4 w-4" />
                  Scheduled date
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Always repeats on the same schedule
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-background cursor-pointer">
              <RadioGroupItem value="completion" id="completion" />
              <div className="flex-1">
                <Label htmlFor="completion" className="cursor-pointer flex items-center gap-2 font-medium text-sm">
                  <RotateCcw className="h-4 w-4" />
                  Completion date
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Next task starts from when completed
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Member Rotation */}
        {assignedMembers.length > 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <Label className="text-sm font-medium">Rotate between members</Label>
              </div>
              <Switch
                checked={options.rotateBetweenMembers || false}
                onCheckedChange={(checked) => updateOptions({ rotateBetweenMembers: checked })}
              />
            </div>
            
            {options.rotateBetweenMembers && (
              <div className="pl-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Each new occurrence will be assigned to the next person in order:
                </p>
                <div className="flex flex-wrap gap-1">
                  {assignedMembers.map((member, index) => (
                    <span key={member.id} className="text-xs bg-background border rounded px-2 py-1">
                      {index + 1}. {member.display_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skip Weekends */}
        {options.rotateBetweenMembers && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Skip weekends</Label>
              <Switch
                checked={options.skipWeekends || false}
                onCheckedChange={(checked) => updateOptions({ skipWeekends: checked })}
              />
            </div>
            {options.skipWeekends && (
              <p className="text-xs text-muted-foreground">
                Tasks won't be assigned on Saturday or Sunday
              </p>
            )}
          </div>
        )}

        {/* Pause During Holidays */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              <Label className="text-sm font-medium">Pause during school holidays</Label>
            </div>
            <Switch
              checked={options.pauseDuringHolidays || false}
              onCheckedChange={(checked) => updateOptions({ pauseDuringHolidays: checked })}
            />
          </div>
          {options.pauseDuringHolidays && (
            <p className="text-xs text-muted-foreground">
              Tasks will be paused during holiday periods (configurable in household settings)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};