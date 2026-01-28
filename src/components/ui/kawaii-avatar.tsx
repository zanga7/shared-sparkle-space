import * as React from 'react';
import { useEffect, useRef, useCallback } from 'react';
import { KawaiiFaceOverlay, KawaiiFaceStyle } from './kawaii-face-overlay';
import { kawaiiScheduler } from '@/lib/kawaii-scheduler';
import { useKawaiiSettings } from '@/contexts/KawaiiContext';
import { cn } from '@/lib/utils';

type SizeKey = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<SizeKey, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
};

interface KawaiiAvatarProps {
  children: React.ReactNode;
  size: number | SizeKey;
  seed?: string | number;
  faceStyle?: KawaiiFaceStyle;
  animate?: boolean;
  enabled?: boolean;
  className?: string;
}

/**
 * Wrapper component that adds kawaii face overlay to any avatar.
 * Registers with the global animation scheduler for occasional micro-animations.
 */
export function KawaiiAvatar({
  children,
  size: sizeProp,
  seed,
  faceStyle: faceStyleProp,
  animate: animateProp,
  enabled: enabledProp,
  className,
}: KawaiiAvatarProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const settings = useKawaiiSettings();
  
  // Resolve size to pixels
  const sizePixels = typeof sizeProp === 'string' 
    ? SIZE_MAP[sizeProp] ?? 32 
    : sizeProp;
  
  // Determine if faces/animations are enabled
  const facesEnabled = enabledProp ?? settings.enabled;
  const animationsEnabled = (animateProp ?? settings.animationsEnabled) && 
    sizePixels >= settings.minAnimateSize;
  const faceStyle = faceStyleProp ?? settings.defaultStyle;

  // Register/unregister with scheduler
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !facesEnabled || !animationsEnabled) return;

    kawaiiScheduler.registerAvatar(wrapper, {
      seed: seed ?? Math.random(),
      size: sizePixels,
    });

    return () => {
      kawaiiScheduler.unregisterAvatar(wrapper);
    };
  }, [facesEnabled, animationsEnabled, seed, sizePixels]);

  // Update scheduler settings when they change
  useEffect(() => {
    kawaiiScheduler.setEnabled(settings.animationsEnabled);
    kawaiiScheduler.setMinAnimateSize(settings.minAnimateSize);
    kawaiiScheduler.setFrequency(settings.animationFrequency);
  }, [settings.animationsEnabled, settings.minAnimateSize, settings.animationFrequency]);

  // If faces are disabled, just render children
  if (!facesEnabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative inline-flex items-center justify-center',
        className
      )}
      style={{ 
        width: sizePixels, 
        height: sizePixels,
        overflow: 'visible',
      }}
    >
      {children}
      <KawaiiFaceOverlay 
        size={sizePixels} 
        faceStyle={faceStyle}
      />
    </div>
  );
}
