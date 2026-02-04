import * as React from 'react';
import { cn } from '@/lib/utils';

export type KawaiiFaceStyle = 'line' | 'round' | 'happy';

interface KawaiiFaceOverlayProps {
  size: number;
  faceStyle: KawaiiFaceStyle;
  className?: string;
  isHovered?: boolean;
}

/**
 * Renders a kawaii-style face overlay as an inline SVG.
 * Uses minimal shapes with black/white only for performance.
 * Positioned absolutely in center of parent container.
 */
export function KawaiiFaceOverlay({ size, faceStyle, className, isHovered = false }: KawaiiFaceOverlayProps) {
  // Scale stroke width based on size for readability
  const strokeWidth = Math.max(1.5, size * 0.06);
  
  // Face elements scale with container
  const eyeOffsetX = size * 0.18;
  const eyeY = size * 0.42;
  const mouthY = size * 0.62;
  const centerX = size / 2;
  
  const renderEyes = () => {
    // When hovered, show a wink (left eye closed, right eye open)
    if (isHovered) {
      return (
        <>
          {/* Left eye - winking (closed arc) */}
          <g className="kawaii-eye-left">
            <path
              d={`M ${centerX - eyeOffsetX - size * 0.07} ${eyeY} Q ${centerX - eyeOffsetX} ${eyeY + size * 0.06} ${centerX - eyeOffsetX + size * 0.07} ${eyeY}`}
              fill="none"
              stroke="black"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </g>
          {/* Right eye - open and happy */}
          <g className="kawaii-eye-right">
            <path
              d={`M ${centerX + eyeOffsetX - size * 0.07} ${eyeY - size * 0.02} Q ${centerX + eyeOffsetX} ${eyeY + size * 0.06} ${centerX + eyeOffsetX + size * 0.07} ${eyeY - size * 0.02}`}
              fill="none"
              stroke="black"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </g>
        </>
      );
    }

    switch (faceStyle) {
      case 'line':
        // Curved line eyes (^_^)
        return (
          <>
            <g className="kawaii-eye-left">
              <path
                d={`M ${centerX - eyeOffsetX - size * 0.06} ${eyeY} Q ${centerX - eyeOffsetX} ${eyeY - size * 0.08} ${centerX - eyeOffsetX + size * 0.06} ${eyeY}`}
                fill="none"
                stroke="black"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </g>
            <g className="kawaii-eye-right">
              <path
                d={`M ${centerX + eyeOffsetX - size * 0.06} ${eyeY} Q ${centerX + eyeOffsetX} ${eyeY - size * 0.08} ${centerX + eyeOffsetX + size * 0.06} ${eyeY}`}
                fill="none"
                stroke="black"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </g>
          </>
        );
      
      case 'round':
        // Small filled circles
        const eyeRadius = size * 0.045;
        return (
          <>
            <g className="kawaii-eye-left">
              <circle
                cx={centerX - eyeOffsetX}
                cy={eyeY}
                r={eyeRadius}
                fill="black"
              />
            </g>
            <g className="kawaii-eye-right">
              <circle
                cx={centerX + eyeOffsetX}
                cy={eyeY}
                r={eyeRadius}
                fill="black"
              />
            </g>
          </>
        );
      
      case 'happy':
        // Upside-down arcs (smiling eyes)
        return (
          <>
            <g className="kawaii-eye-left">
              <path
                d={`M ${centerX - eyeOffsetX - size * 0.07} ${eyeY - size * 0.02} Q ${centerX - eyeOffsetX} ${eyeY + size * 0.06} ${centerX - eyeOffsetX + size * 0.07} ${eyeY - size * 0.02}`}
                fill="none"
                stroke="black"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </g>
            <g className="kawaii-eye-right">
              <path
                d={`M ${centerX + eyeOffsetX - size * 0.07} ${eyeY - size * 0.02} Q ${centerX + eyeOffsetX} ${eyeY + size * 0.06} ${centerX + eyeOffsetX + size * 0.07} ${eyeY - size * 0.02}`}
                fill="none"
                stroke="black"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </g>
          </>
        );
    }
  };

  const renderMouth = () => {
    // When hovered, show open mouth with tongue
    if (isHovered) {
      const mouthWidth = size * 0.12;
      const mouthHeight = size * 0.08;
      return (
        <g className="kawaii-mouth">
          {/* Open mouth */}
          <ellipse
            cx={centerX}
            cy={mouthY + size * 0.02}
            rx={mouthWidth}
            ry={mouthHeight}
            fill="black"
          />
          {/* Tongue poking out */}
          <ellipse
            cx={centerX}
            cy={mouthY + size * 0.07}
            rx={size * 0.06}
            ry={size * 0.04}
            fill="#ff6b8a"
          />
        </g>
      );
    }

    const mouthWidth = faceStyle === 'happy' ? size * 0.14 : size * 0.1;
    const curveDepth = faceStyle === 'happy' ? size * 0.06 : size * 0.04;
    
    return (
      <g className="kawaii-mouth">
        <path
          d={`M ${centerX - mouthWidth} ${mouthY} Q ${centerX} ${mouthY + curveDepth} ${centerX + mouthWidth} ${mouthY}`}
          fill="none"
          stroke="black"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </g>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(
        'absolute inset-0 pointer-events-none z-10 transition-transform duration-200',
        className
      )}
      style={{ 
        width: size, 
        height: size,
      }}
      aria-hidden="true"
    >
      {renderEyes()}
      {renderMouth()}
    </svg>
  );
}
