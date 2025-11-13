import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

import { cn } from "@/lib/utils"
import { AvatarIconType } from "./avatar-icon-selector"
import { useMemberColor } from "@/hooks/useMemberColor"

interface UserAvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  avatarIcon?: string
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm', 
  lg: 'h-10 w-10 text-base'
}

const UserAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  UserAvatarProps
>(({ className, name, color = 'sky', size = 'md', avatarIcon, ...props }, ref) => {
  const { hex: colorHex, styles: colorStyles } = useMemberColor(color);
  
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

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden",
        !iconData && "rounded-full",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <AvatarPrimitive.Fallback 
        className={cn(
          "flex h-full w-full items-center justify-center font-medium",
          !iconData && "rounded-full"
        )}
        style={!iconData ? colorStyles.avatar : undefined}
      >
        {iconData ? (
          <div 
            className="w-full h-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full"
            dangerouslySetInnerHTML={{ __html: iconData.svg_content }}
          />
        ) : (
          getInitials(name)
        )}
        {iconData && (
          <style>
            {`
              [data-avatar="${avatarIcon}"] .cls-1 {
                fill: ${colorHex} !important;
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