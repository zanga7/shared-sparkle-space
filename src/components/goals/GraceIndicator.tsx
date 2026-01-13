import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface GraceIndicatorProps {
  graceRemaining: number;
  graceUsed: number;
  totalDays: number;
  thresholdPercent: number;
  className?: string;
}

export function GraceIndicator({ 
  graceRemaining, 
  graceUsed, 
  totalDays, 
  thresholdPercent,
  className 
}: GraceIndicatorProps) {
  const totalGrace = Math.floor(totalDays * (1 - thresholdPercent / 100));
  const gracePercent = totalGrace > 0 ? (graceRemaining / totalGrace) * 100 : 0;
  
  const getIcon = () => {
    if (graceRemaining <= 0) {
      return <ShieldAlert className="h-5 w-5 text-destructive" />;
    }
    if (gracePercent < 30) {
      return <Shield className="h-5 w-5 text-amber-500" />;
    }
    return <ShieldCheck className="h-5 w-5 text-green-500" />;
  };

  const getMessage = () => {
    if (graceRemaining <= 0) {
      return "No grace days left - every day counts!";
    }
    if (graceRemaining === 1) {
      return "1 grace day remaining";
    }
    return `${graceRemaining} grace days remaining`;
  };

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg bg-muted/50',
      className
    )}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{getMessage()}</div>
        <div className="text-xs text-muted-foreground">
          You can miss up to {totalGrace} days and still reach {thresholdPercent}%
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold">{graceRemaining}</div>
        <div className="text-xs text-muted-foreground">of {totalGrace}</div>
      </div>
    </div>
  );
}
