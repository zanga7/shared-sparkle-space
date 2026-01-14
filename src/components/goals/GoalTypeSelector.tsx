import { Flame, Target, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalType } from '@/types/goal';

interface GoalTypeSelectorProps {
  selectedType: GoalType | null;
  onSelect: (type: GoalType) => void;
}

const goalTypes = [
  {
    type: 'consistency' as GoalType,
    icon: Flame,
    title: 'Consistency / Streaks',
    description: 'Build a habit with daily or weekly streak tracking',
    examples: 'e.g., 30 days of reading, brush teeth daily'
  },
  {
    type: 'target_count' as GoalType,
    icon: Target,
    title: 'Target Count',
    description: 'Reach a total number of task completions',
    examples: 'e.g., 50 walks, 100 homework sessions'
  },
  {
    type: 'project' as GoalType,
    icon: ListChecks,
    title: 'Project',
    description: 'Complete milestones to achieve a bigger goal',
    examples: 'e.g., build a treehouse, plan a party'
  }
];

export function GoalTypeSelector({ selectedType, onSelect }: GoalTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">What type of goal?</h2>
        <p className="text-sm text-muted-foreground">
          Choose how you want to track progress
        </p>
      </div>
      
      <div className="grid gap-3">
        {goalTypes.map((goalType) => {
          const Icon = goalType.icon;
          const isSelected = selectedType === goalType.type;
          
          return (
            <button
              key={goalType.type}
              onClick={() => onSelect(goalType.type)}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border text-left transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                isSelected && 'border-primary bg-primary/10 ring-1 ring-primary'
              )}
            >
              <div className={cn(
                'p-2.5 rounded-full shrink-0',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'font-medium',
                  isSelected && 'text-primary'
                )}>
                  {goalType.title}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {goalType.description}
                </div>
                <div className="text-xs text-muted-foreground/70 mt-1 italic">
                  {goalType.examples}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
