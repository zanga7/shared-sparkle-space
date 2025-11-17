import { cn, sanitizeSVG } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AvatarIconType = string;

interface AvatarIcon {
  id: string;
  name: string;
  svg_content: string;
  is_system: boolean;
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
  // Fetch avatar icons from database
  const { data: avatarIcons = [] } = useQuery({
    queryKey: ['avatar-icons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_icons')
        .select('*')
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
    <div className={cn("grid grid-cols-3 gap-3", className)}>
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
              "relative p-3 rounded-lg border-2 transition-all",
              isSelected && "border-primary ring-2 ring-primary ring-offset-2",
              !isSelected && !isUsed && "border-border hover:border-primary/50",
              isUsed && "opacity-40 cursor-not-allowed bg-muted"
            )}
          >
            <div 
              className="w-12 h-12 mx-auto [&_svg]:w-full [&_svg]:h-full [&_path]:transition-colors"
              dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.svg_content) }}
              style={{
                ['--icon-color' as any]: activeColorHex,
              }}
            />
            <style>
              {`
                button[data-icon="${icon.name}"] .cls-1 {
                  fill: ${activeColorHex} !important;
                }
              `}
            </style>
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
