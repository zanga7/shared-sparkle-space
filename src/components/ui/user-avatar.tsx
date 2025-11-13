import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn, getMemberColorClasses } from "@/lib/utils"
import { AVATAR_ICONS, AvatarIconType } from "./avatar-icon-selector"

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
>(({ className, name, color, size = 'md', avatarIcon, ...props }, ref) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const colorClasses = getMemberColorClasses(color);
  const iconSrc = avatarIcon && avatarIcon in AVATAR_ICONS 
    ? AVATAR_ICONS[avatarIcon as AvatarIconType]
    : null;

  const getColorFilter = (color: string = 'sky') => {
    const filterMap: Record<string, string> = {
      sky: 'brightness(0) saturate(100%) invert(58%) sepia(65%) saturate(3000%) hue-rotate(180deg)',
      rose: 'brightness(0) saturate(100%) invert(49%) sepia(100%) saturate(2000%) hue-rotate(330deg)',
      emerald: 'brightness(0) saturate(100%) invert(60%) sepia(80%) saturate(1500%) hue-rotate(120deg)',
      amber: 'brightness(0) saturate(100%) invert(70%) sepia(100%) saturate(2000%) hue-rotate(20deg)',
      violet: 'brightness(0) saturate(100%) invert(45%) sepia(90%) saturate(1500%) hue-rotate(240deg)',
    };
    return filterMap[color] || filterMap.sky;
  };

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden",
        !iconSrc && "rounded-full",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <AvatarPrimitive.Fallback 
        className={cn(
          "flex h-full w-full items-center justify-center font-medium",
          !iconSrc && "rounded-full",
          !iconSrc && colorClasses.avatar
        )}
      >
        {iconSrc ? (
          <img 
            src={iconSrc} 
            alt={name}
            className="w-full h-full object-contain"
            style={{ 
              filter: getColorFilter(color)
            }}
          />
        ) : (
          getInitials(name)
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
})
UserAvatar.displayName = "UserAvatar"

export { UserAvatar }