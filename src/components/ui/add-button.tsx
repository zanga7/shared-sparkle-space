import { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddButtonProps extends ButtonProps {
  text?: string;
  showIcon?: boolean;
}

export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ text = 'Add', showIcon = true, className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        className={cn(
          "justify-end gap-2 text-muted-foreground hover:text-foreground hover:bg-accent",
          className
        )}
        {...props}
      >
        {showIcon && <Plus className="h-3 w-3" />}
        {children || text}
      </Button>
    );
  }
);

AddButton.displayName = 'AddButton';