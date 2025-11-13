import { cn } from '@/lib/utils';
import Av1 from '@/assets/avatars/av1.svg';
import Av2 from '@/assets/avatars/av2.svg';
import Av3 from '@/assets/avatars/av3.svg';
import Av4 from '@/assets/avatars/av4.svg';
import Av5 from '@/assets/avatars/av5.svg';
import Av6 from '@/assets/avatars/av6.svg';

export const AVATAR_ICONS = {
  av1: Av1,
  av2: Av2,
  av3: Av3,
  av4: Av4,
  av5: Av5,
  av6: Av6,
} as const;

export type AvatarIconType = keyof typeof AVATAR_ICONS;

interface AvatarIconSelectorProps {
  selectedIcon?: string;
  selectedColor?: string;
  usedIcons?: string[];
  onIconSelect: (icon: AvatarIconType) => void;
  className?: string;
}

export function AvatarIconSelector({
  selectedIcon,
  selectedColor = 'sky',
  usedIcons = [],
  onIconSelect,
  className
}: AvatarIconSelectorProps) {
  const getColorFill = (color: string) => {
    const colorMap: Record<string, string> = {
      sky: '#0ea5e9',
      rose: '#f43f5e',
      emerald: '#10b981',
      amber: '#f59e0b',
      violet: '#8b5cf6',
    };
    return colorMap[color] || colorMap.sky;
  };

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {Object.entries(AVATAR_ICONS).map(([key, icon]) => {
        const isUsed = usedIcons.includes(key);
        const isSelected = selectedIcon === key;
        
        return (
          <button
            key={key}
            type="button"
            onClick={() => !isUsed && onIconSelect(key as AvatarIconType)}
            disabled={isUsed}
            className={cn(
              "relative p-3 rounded-lg border-2 transition-all",
              isSelected && "border-primary ring-2 ring-primary ring-offset-2",
              !isSelected && !isUsed && "border-border hover:border-primary/50",
              isUsed && "opacity-40 cursor-not-allowed bg-muted"
            )}
          >
            <div className="w-12 h-12 mx-auto">
              <img
                src={icon}
                alt={`Avatar ${key}`}
                className="w-full h-full"
                style={{
                  filter: `brightness(0) saturate(100%) invert(${getFilterInvert(selectedColor)})`,
                }}
              />
            </div>
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-destructive">
                Used
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Helper function to convert color to filter values
function getFilterInvert(color: string): string {
  // These values approximate the color using CSS filters
  const filterMap: Record<string, string> = {
    sky: '58% sepia(65%) saturate(3000%) hue-rotate(180deg)',
    rose: '49% sepia(100%) saturate(2000%) hue-rotate(330deg)',
    emerald: '60% sepia(80%) saturate(1500%) hue-rotate(120deg)',
    amber: '70% sepia(100%) saturate(2000%) hue-rotate(20deg)',
    violet: '45% sepia(90%) saturate(1500%) hue-rotate(240deg)',
  };
  return filterMap[color] || filterMap.sky;
}
