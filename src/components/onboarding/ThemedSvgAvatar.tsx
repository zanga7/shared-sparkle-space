import React, { useMemo } from 'react';
import { cn, sanitizeSVG } from '@/lib/utils';

type ThemedSvgAvatarProps = {
  svg: string;
  className?: string;
  label?: string;
};

/**
 * Renders an SVG string inline so it can inherit theme colors via `currentColor`.
 * (Using <img src="..."> isolates SVG styles so Tailwind text colors won't apply.)
 */
export function ThemedSvgAvatar({ svg, className, label }: ThemedSvgAvatarProps) {
  const sanitized = useMemo(() => {
    const withCurrentColor = svg
      // Replace the hardcoded fill used by our avatar SVGs
      .replace(/#231f20/gi, 'currentColor')
      // Ensure the root svg has a default fill
      .replace(/<svg\b(?![^>]*\bfill=)/i, '<svg fill="currentColor"');

    return sanitizeSVG(withCurrentColor);
  }, [svg]);

  return (
    <span
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
      className={cn(
        'inline-flex items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full',
        className
      )}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
