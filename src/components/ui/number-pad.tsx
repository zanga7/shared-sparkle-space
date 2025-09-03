import React from 'react';
import { Button } from '@/components/ui/button';
import { Backspace } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberPadProps {
  onNumberPress: (number: string) => void;
  onBackspace: () => void;
  className?: string;
  disabled?: boolean;
}

export function NumberPad({ onNumberPress, onBackspace, className, disabled }: NumberPadProps) {
  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['', '0', 'backspace']
  ];

  return (
    <div className={cn("grid grid-cols-3 gap-3 max-w-xs mx-auto", className)}>
      {numbers.flat().map((value, index) => {
        if (value === '') {
          return <div key={index} />; // Empty space
        }

        if (value === 'backspace') {
          return (
            <Button
              key={index}
              variant="outline"
              size="lg"
              onClick={onBackspace}
              disabled={disabled}
              className="h-14 text-lg font-semibold hover:bg-muted/50 active:scale-95 transition-transform"
              aria-label="Delete"
            >
              <Backspace className="h-5 w-5" />
            </Button>
          );
        }

        return (
          <Button
            key={index}
            variant="outline"
            size="lg"
            onClick={() => onNumberPress(value)}
            disabled={disabled}
            className="h-14 text-xl font-semibold hover:bg-muted/50 active:scale-95 transition-transform"
          >
            {value}
          </Button>
        );
      })}
    </div>
  );
}