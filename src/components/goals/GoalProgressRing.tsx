import { cn } from '@/lib/utils';

interface GoalProgressRingProps {
  percent: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: string;
  className?: string;
}

export function GoalProgressRing({ 
  percent, 
  size = 'md', 
  showLabel = true,
  color,
  className 
}: GoalProgressRingProps) {
  const sizes = {
    sm: { width: 48, strokeWidth: 4, fontSize: 'text-xs' },
    md: { width: 80, strokeWidth: 6, fontSize: 'text-lg' },
    lg: { width: 120, strokeWidth: 8, fontSize: 'text-2xl' }
  };
  
  const { width, strokeWidth, fontSize } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  
  const getStatusColor = () => {
    if (color) return color;
    if (percent >= 100) return 'hsl(var(--success))';
    if (percent >= 70) return 'hsl(var(--primary))';
    if (percent >= 40) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={width} height={width} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={getStatusColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <span className={cn(
          'absolute font-semibold text-foreground',
          fontSize
        )}>
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}
