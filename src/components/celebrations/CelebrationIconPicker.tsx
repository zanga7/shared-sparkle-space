import { useCelebrationIcons } from '@/hooks/useCelebrations';
import { cn, sanitizeSVG } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface CelebrationIconPickerProps {
  selectedIconId?: string;
  onIconSelect: (iconId: string) => void;
  className?: string;
}

export const CelebrationIconPicker = ({
  selectedIconId,
  onIconSelect,
  className,
}: CelebrationIconPickerProps) => {
  const { data: icons, isLoading } = useCelebrationIcons();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!icons || icons.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No celebration icons available
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 md:grid-cols-6 gap-3", className)}>
      {(icons as any[]).map((icon: any) => (
        <button
          key={icon.id}
          type="button"
          onClick={() => onIconSelect(icon.id)}
          className={cn(
            "p-4 rounded-lg border-2 hover:border-primary transition-colors",
            "flex items-center justify-center aspect-square",
            selectedIconId === icon.id
              ? "border-primary bg-primary/10"
              : "border-border bg-background"
          )}
          title={icon.name}
        >
          <div
            className="w-8 h-8 text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.svg_content) }}
          />
        </button>
      ))}
    </div>
  );
};
