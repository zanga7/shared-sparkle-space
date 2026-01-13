import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

import { cn, sanitizeSVG } from "@/lib/utils"
import { AvatarIconType } from "./avatar-icon-selector"
import { useMemberColor } from "@/hooks/useMemberColor"

interface UserAvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  name: string
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  avatarIcon?: string
}

const sizeClasses = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm', 
  lg: 'h-10 w-10 text-base'
}

const UserAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  UserAvatarProps
>(({ className, name, color = 'sky', size = 'md', avatarIcon, ...props }, ref) => {
  const isWhite = color === 'white';
  // For white color, use a default color for the hook but override the hex
  const { hex: colorHex, styles: colorStyles } = useMemberColor(isWhite ? 'sky' : color);
  const finalColorHex = isWhite ? '#ffffff' : colorHex;
  
  // Fetch avatar icons from database
  const { data: avatarIcons = [] } = useQuery({
    queryKey: ['avatar-icons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_icons')
        .select('*');
      
      if (error) throw error;
      return data as Array<{ id: string; name: string; svg_content: string }>;
    }
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const iconData = avatarIcons.find(icon => icon.name === avatarIcon);

  // Debug logging
  React.useEffect(() => {
    if (avatarIcon) {
      console.log('UserAvatar debug:', {
        avatarIcon,
        avatarIconsCount: avatarIcons.length,
        iconData: iconData ? 'found' : 'not found',
        color,
        isWhite,
        finalColorHex
      });
    }
  }, [avatarIcon, avatarIcons, iconData, color, isWhite, finalColorHex]);

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden",
        !iconData && "rounded-full",
        sizeClasses[size],
        className
      )}
      data-avatar={avatarIcon || undefined}
      {...props}
    >
      <AvatarPrimitive.Fallback 
        className={cn(
          "flex h-full w-full items-center justify-center font-medium",
          !iconData && "rounded-full"
        )}
        style={!iconData ? (isWhite ? { backgroundColor: 'transparent', color: '#ffffff' } : colorStyles.avatar) : undefined}
      >
        {iconData ? (
          <div 
            className="w-full h-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full"
            style={{ color: finalColorHex }}
            dangerouslySetInnerHTML={{ __html: sanitizeSVG(iconData.svg_content) }}
          />
        ) : (
          getInitials(name)
        )}
        {iconData && (
          <style>
            {`
              [data-avatar="${avatarIcon}"] svg path,
              [data-avatar="${avatarIcon}"] svg circle,
              [data-avatar="${avatarIcon}"] svg rect,
              [data-avatar="${avatarIcon}"] svg polygon,
              [data-avatar="${avatarIcon}"] svg g [fill] {
                fill: ${finalColorHex} !important;
              }
              [data-avatar="${avatarIcon}"] svg * {
                stroke: ${finalColorHex} !important;
              }
            `}
          </style>
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
})
UserAvatar.displayName = "UserAvatar"

export { UserAvatar }