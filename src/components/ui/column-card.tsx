import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface ColumnCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'member'
  memberColor?: string
}

const ColumnCard = React.forwardRef<HTMLDivElement, ColumnCardProps>(
  ({ className, variant = 'default', memberColor, ...props }, ref) => {
    const getMemberColorClasses = (color: string = 'sky') => {
      const colorMap = {
        sky: {
          bg: 'bg-sky-100 dark:bg-sky-950',
          bgSoft: 'bg-sky-50 dark:bg-sky-900/20',
          bg10: 'bg-sky-500/10',
          border: 'border-sky-300 dark:border-sky-700',
        },
        rose: {
          bg: 'bg-rose-100 dark:bg-rose-950',
          bgSoft: 'bg-rose-50 dark:bg-rose-900/20',
          bg10: 'bg-rose-500/10',
          border: 'border-rose-300 dark:border-rose-700',
        },
        emerald: {
          bg: 'bg-emerald-100 dark:bg-emerald-950',
          bgSoft: 'bg-emerald-50 dark:bg-emerald-900/20',
          bg10: 'bg-emerald-500/10',
          border: 'border-emerald-300 dark:border-emerald-700',
        },
        amber: {
          bg: 'bg-amber-100 dark:bg-amber-950',
          bgSoft: 'bg-amber-50 dark:bg-amber-900/20',
          bg10: 'bg-amber-500/10',
          border: 'border-amber-300 dark:border-amber-700',
        },
        violet: {
          bg: 'bg-violet-100 dark:bg-violet-950',
          bgSoft: 'bg-violet-50 dark:bg-violet-900/20',
          bg10: 'bg-violet-500/10',
          border: 'border-violet-300 dark:border-violet-700',
        },
      };
    
      return colorMap[color as keyof typeof colorMap] || colorMap.sky;
    };

    const memberColors = memberColor ? getMemberColorClasses(memberColor) : null;

    return (
      <Card
        ref={ref}
        className={cn(
          "flex-shrink-0 w-72 sm:w-80 h-fit",
          variant === 'member' && memberColors && [
            "border-2",
            memberColors.border,
            memberColors.bg10
          ],
          className
        )}
        {...props}
      />
    )
  }
)
ColumnCard.displayName = "ColumnCard"

export { ColumnCard }