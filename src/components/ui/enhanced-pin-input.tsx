import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PinInput } from "@/components/ui/pin-input";
import { NumberPad } from "@/components/ui/number-pad";
import { IconPinInput } from "@/components/ui/icon-pin-input";
import { cn } from "@/lib/utils";
import { Hash, Smile } from "lucide-react";

interface EnhancedPinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onPinTypeChange?: (type: 'numeric' | 'icon') => void;
  length?: number;
  disabled?: boolean;
  className?: string;
  allowIconPin?: boolean;
  pinType?: 'numeric' | 'icon';
  showNumberPad?: boolean;
  label?: string;
}

export function EnhancedPinInput({
  value,
  onChange,
  onComplete,
  onPinTypeChange,
  length = 4,
  disabled,
  className,
  allowIconPin = true,
  pinType = 'numeric',
  showNumberPad = true,
  label = "PIN"
}: EnhancedPinInputProps) {
  const [currentPinType, setCurrentPinType] = useState<'numeric' | 'icon'>(pinType);

  const handlePinTypeChange = (type: 'numeric' | 'icon') => {
    setCurrentPinType(type);
    onChange(''); // Clear current value when switching types
    onPinTypeChange?.(type);
  };

  const handleNumberPadPress = (number: string) => {
    if (disabled || value.length >= length) return;
    
    const newValue = value + number;
    onChange(newValue);
    
    if (newValue.length === length && onComplete) {
      onComplete(newValue);
    }
  };

  const handleNumberPadDelete = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  if (!allowIconPin) {
    // Simple numeric PIN with optional number pad
    return (
      <div className={cn("space-y-4", className)}>
        {label && <Label>{label}</Label>}
        <PinInput
          value={value}
          onChange={onChange}
          onComplete={onComplete}
          length={length}
          disabled={disabled}
        />
        {showNumberPad && (
          <NumberPad
            onNumberPress={handleNumberPadPress}
            onDelete={handleNumberPadDelete}
            disabled={disabled}
            className="mt-4"
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {label && <Label>{label}</Label>}
      
      <Tabs value={currentPinType} onValueChange={handlePinTypeChange as any}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="numeric" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Numbers
          </TabsTrigger>
          <TabsTrigger value="icon" className="flex items-center gap-2">
            <Smile className="h-4 w-4" />
            Icons
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="numeric" className="space-y-4">
          <PinInput
            value={value}
            onChange={onChange}
            onComplete={onComplete}
            length={length}
            disabled={disabled}
          />
          {showNumberPad && (
            <NumberPad
              onNumberPress={handleNumberPadPress}
              onDelete={handleNumberPadDelete}
              disabled={disabled}
              className="mt-4"
            />
          )}
        </TabsContent>
        
        <TabsContent value="icon" className="space-y-4">
          <IconPinInput
            value={value}
            onChange={onChange}
            onComplete={onComplete}
            length={length}
            disabled={disabled}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}