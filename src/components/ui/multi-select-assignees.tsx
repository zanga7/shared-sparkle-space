import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Profile } from '@/types/task';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface MultiSelectAssigneesProps {
  familyMembers: Profile[];
  selectedAssignees: string[];
  onAssigneesChange: (assignees: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectAssignees({
  familyMembers,
  selectedAssignees,
  onAssigneesChange,
  placeholder = "Select assignees...",
  className
}: MultiSelectAssigneesProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Ensure selectedAssignees is always an array
  const safeSelectedAssignees = selectedAssignees || [];

  const selectedMembers = familyMembers.filter(member => 
    safeSelectedAssignees.includes(member.id)
  );

  const availableMembers = familyMembers.filter(member => 
    !safeSelectedAssignees.includes(member.id)
  );

  const toggleAssignee = (profileId: string) => {
    const newAssignees = safeSelectedAssignees.includes(profileId)
      ? safeSelectedAssignees.filter(id => id !== profileId)
      : [...safeSelectedAssignees, profileId];
    onAssigneesChange(newAssignees);
  };

  const removeAssignee = (profileId: string) => {
    onAssigneesChange(safeSelectedAssignees.filter(id => id !== profileId));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected assignees display */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMembers.map((member) => (
            <Badge 
              key={member.id} 
              variant="secondary" 
              className="flex items-center gap-2 pr-1 py-1"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getInitials(member.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{member.display_name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => removeAssignee(member.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Assignee selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              {selectedMembers.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm">
                    {selectedMembers.length === 1 
                      ? selectedMembers[0].display_name
                      : `${selectedMembers.length} people selected`
                    }
                  </span>
                </div>
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search family members..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandEmpty>No family members found.</CommandEmpty>
            <CommandGroup heading="Assignees">
              {/* Anyone can do it option */}
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onAssigneesChange([]);
                  setOpen(false);
                }}
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-2 flex-1">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-muted">
                      ?
                    </AvatarFallback>
                  </Avatar>
                  <span>Anyone can do it</span>
                </div>
                <Check
                  className={cn(
                    "h-4 w-4",
                    selectedAssignees.length === 0 ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
              
              {/* Family members */}
              {familyMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.display_name}
                  onSelect={() => toggleAssignee(member.id)}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(member.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{member.display_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {member.role}
                      </span>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      safeSelectedAssignees.includes(member.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}