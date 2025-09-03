import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Delete } from "lucide-react";

// Icon library for PIN creation
const ICON_LIBRARY = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🌟', '🌙', '☀️', '⭐', '🌈', '❤️', '💙', '💚',
  '🚗', '🚌', '🚲', '✈️', '🚂', '🛸', '🚁', '⛵',
  '🏠', '🏰', '🗼', '🎪', '🎡', '🎢', '🎠', '🎯',
  '🍎', '🍌', '🍊', '🍇', '🍓', '🍒', '🥕', '🥖',
  '⚽', '🏀', '🎾', '🏈', '🎱', '🏓', '🎳', '🎮'
];

interface IconPinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
}

export function IconPinInput({
  value,
  onChange,
  onComplete,
  length = 4,
  disabled,
  className
}: IconPinInputProps) {
  const [selectedIcons, setSelectedIcons] = useState<string[]>(
    value ? value.split('') : []
  );

  const handleIconSelect = (icon: string) => {
    if (disabled || selectedIcons.length >= length) return;

    const newIcons = [...selectedIcons, icon];
    setSelectedIcons(newIcons);
    
    const newValue = newIcons.join('');
    onChange(newValue);
    
    if (newIcons.length === length && onComplete) {
      onComplete(newValue);
    }
  };

  const handleDelete = () => {
    if (disabled || selectedIcons.length === 0) return;

    const newIcons = selectedIcons.slice(0, -1);
    setSelectedIcons(newIcons);
    onChange(newIcons.join(''));
  };

  const handleClear = () => {
    setSelectedIcons([]);
    onChange('');
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selected Icons Display */}
      <div className="flex justify-center gap-2 mb-6">
        {Array.from({ length }).map((_, index) => (
          <div
            key={index}
            className="w-16 h-16 border-2 border-border rounded-lg flex items-center justify-center bg-muted/50 text-2xl"
          >
            {selectedIcons[index] || ''}
          </div>
        ))}
      </div>

      {/* Icon Selection Grid */}
      <div className="grid grid-cols-8 gap-2 max-w-2xl mx-auto">
        {ICON_LIBRARY.map((icon, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => handleIconSelect(icon)}
            disabled={disabled || selectedIcons.length >= length}
            className="h-12 w-12 text-xl hover:bg-muted/50 p-0"
          >
            {icon}
          </Button>
        ))}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-2 mt-4">
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={disabled || selectedIcons.length === 0}
          className="flex items-center gap-2"
        >
          <Delete className="h-4 w-4" />
          Remove
        </Button>
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={disabled || selectedIcons.length === 0}
        >
          Clear All
        </Button>
      </div>
    </div>
  );
}