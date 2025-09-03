import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Delete } from "lucide-react";

interface NumberPadProps {
  onNumberPress: (number: string) => void;
  onDelete: () => void;
  className?: string;
  disabled?: boolean;
}

export function NumberPad({ onNumberPress, onDelete, className, disabled }: NumberPadProps) {
  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫']
  ];

  return (
    <div className={cn("grid grid-cols-3 gap-3 max-w-xs mx-auto", className)}>
      {numbers.flat().map((num, index) => {
        if (num === '') {
          return <div key={index} />; // Empty space
        }
        
        if (num === '⌫') {
          return (
            <Button
              key={index}
              variant="outline"
              size="lg"
              onClick={onDelete}
              disabled={disabled}
              className="h-14 w-14 text-lg font-semibold hover:bg-muted/50"
            >
              <Delete className="h-5 w-5" />
            </Button>
          );
        }

        return (
          <Button
            key={index}
            variant="outline"
            size="lg"
            onClick={() => onNumberPress(num)}
            disabled={disabled}
            className="h-14 w-14 text-lg font-semibold hover:bg-muted/50"
          >
            {num}
          </Button>
        );
      })}
    </div>
  );
}