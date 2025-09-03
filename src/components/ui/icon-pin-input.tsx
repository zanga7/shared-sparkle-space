import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Backspace } from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon library for PIN creation - easily recognizable icons for children
const PIN_ICONS = [
  { id: 'dog', emoji: '🐶', label: 'Dog' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
  { id: 'sun', emoji: '☀️', label: 'Sun' },
  { id: 'car', emoji: '🚗', label: 'Car' },
  { id: 'house', emoji: '🏠', label: 'House' },
  { id: 'apple', emoji: '🍎', label: 'Apple' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow' },
  { id: 'flower', emoji: '🌸', label: 'Flower' },
  { id: 'tree', emoji: '🌳', label: 'Tree' },
  { id: 'fish', emoji: '🐟', label: 'Fish' },
  { id: 'bird', emoji: '🐦', label: 'Bird' },
  { id: 'ball', emoji: '⚽', label: 'Ball' },
  { id: 'cake', emoji: '🎂', label: 'Cake' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'crown', emoji: '👑', label: 'Crown' },
  { id: 'pizza', emoji: '🍕', label: 'Pizza' },
  { id: 'butterfly', emoji: '🦋', label: 'Butterfly' }
];

interface IconPinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
  showIcons?: boolean;
}

export function IconPinInput({ 
  value, 
  onChange, 
  onComplete,
  length = 4, 
  disabled,
  className,
  showIcons = true 
}: IconPinInputProps) {
  const handleIconPress = (iconId: string) => {
    if (disabled || value.length >= length) return;
    
    const newValue = value + iconId;
    onChange(newValue);
    
    if (newValue.length === length && onComplete) {
      onComplete(newValue);
    }
  };

  const handleBackspace = () => {
    if (disabled) return;
    const newValue = value.slice(0, -1);
    onChange(newValue);
  };

  const getIconById = (id: string) => {
    return PIN_ICONS.find(icon => icon.id === id);
  };

  const selectedIcons = value.split(',').filter(Boolean);

  return (
    <div className={cn("space-y-6", className)}>
      {/* PIN Display */}
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, index) => {
          const iconId = selectedIcons[index];
          const icon = iconId ? getIconById(iconId) : null;
          
          return (
            <div
              key={index}
              className="w-16 h-16 border-2 border-border rounded-lg flex items-center justify-center bg-background text-2xl"
            >
              {icon ? icon.emoji : ''}
            </div>
          );
        })}
      </div>

      {showIcons && (
        <>
          {/* Icon Grid */}
          <div className="grid grid-cols-5 gap-3 max-w-md mx-auto">
            {PIN_ICONS.map((icon) => (
              <Button
                key={icon.id}
                variant="outline"
                size="lg"
                onClick={() => handleIconPress(icon.id)}
                disabled={disabled || value.length >= length}
                className="h-14 text-2xl hover:bg-muted/50 active:scale-95 transition-transform"
                title={icon.label}
              >
                {icon.emoji}
              </Button>
            ))}
          </div>

          {/* Backspace Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={handleBackspace}
              disabled={disabled || value.length === 0}
              className="h-14 px-8 hover:bg-muted/50 active:scale-95 transition-transform"
              aria-label="Delete"
            >
              <Backspace className="h-5 w-5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export { PIN_ICONS };