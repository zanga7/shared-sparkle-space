import { cn, sanitizeSVG } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AvatarIconType = string;

interface AvatarIcon {
  id: string;
  name: string;
  svg_content: string;
  is_system: boolean;
  icon_type?: string;
}

interface AvatarIconSelectorProps {
  selectedIcon?: string;
  selectedColor?: string;
  selectedColorHex?: string;
  usedIcons?: string[];
  onIconSelect: (icon: AvatarIconType) => void;
  className?: string;
}

export function AvatarIconSelector({
  selectedIcon,
  selectedColor = 'sky',
  selectedColorHex,
  usedIcons = [],
  onIconSelect,
  className
}: AvatarIconSelectorProps) {
  // Fetch avatar icons from database - only avatar type icons, not celebration icons
  const { data: avatarIcons = [] } = useQuery({
    queryKey: ['avatar-icons-for-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_icons')
        .select('*')
        .or('icon_type.eq.avatar,icon_type.is.null')
        .order('name');
      
      if (error) throw error;
      return data as AvatarIcon[];
    }
  });

  // Fetch color from database if not provided
  const { data: colorData } = useQuery({
    queryKey: ['color-palette', selectedColor],
    queryFn: async () => {
      if (selectedColorHex) return null; // Use provided hex
      
      const { data, error } = await supabase
        .from('color_palettes')
        .select('hex_value')
        .eq('color_key', selectedColor)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !selectedColorHex && !!selectedColor
  });

  const activeColorHex = selectedColorHex || colorData?.hex_value || '#0ea5e9';

  if (avatarIcons.length === 0) {
    return <div className="text-sm text-muted-foreground">Loading icons...</div>;
  }

  return (
    <div className={cn("grid grid-cols-3 gap-2 md:gap-3 max-h-64 overflow-y-auto p-1", className)}>
      {avatarIcons.map((icon) => {
        const isUsed = usedIcons.includes(icon.name);
        const isSelected = selectedIcon === icon.name;
        
        return (
          <button
            key={icon.id}
            type="button"
            onClick={() => !isUsed && onIconSelect(icon.name)}
            disabled={isUsed}
            className={cn(
              "relative p-2 md:p-3 rounded-lg border-2 transition-all",
              isSelected && "border-primary ring-2 ring-primary ring-offset-2",
              !isSelected && !isUsed && "border-border hover:border-primary/50",
              isUsed && "opacity-30 cursor-not-allowed bg-muted/50"
            )}
          >
            <div 
              className="w-10 h-10 md:w-12 md:h-12 mx-auto [&_svg]:w-full [&_svg]:h-full [&_path]:transition-colors"
              dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.svg_content) }}
              style={{
                ['--icon-color' as any]: isUsed ? '#9ca3af' : activeColorHex,
              }}
            />
            <style>
              {`
                button[data-icon="${icon.name}"] .cls-1 {
                  fill: ${isUsed ? '#9ca3af' : activeColorHex} !important;
                }
              `}
            </style>
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] md:text-xs font-semibold text-destructive bg-background/80 px-1 rounded">
                  Taken
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
