import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { useMemberColor } from "@/hooks/useMemberColor"

interface ColumnCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'member'
  memberColor?: string
}

const ColumnCard = React.forwardRef<HTMLDivElement, ColumnCardProps>(
  ({ className, variant = 'default', memberColor, ...props }, ref) => {
    const { styles: colorStyles } = useMemberColor(memberColor);

    return (
      <Card
        ref={ref}
        className={cn(
          "flex-shrink-0 w-64 min-w-[16rem] max-w-[20rem] h-fit",
          className
        )}
        style={variant === 'member' && memberColor ? colorStyles.bg10 : undefined}
        {...props}
      />
    )
  }
)
ColumnCard.displayName = "ColumnCard"

export { ColumnCard }