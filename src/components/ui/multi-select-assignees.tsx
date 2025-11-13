import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Profile } from '@/types/task';
import { UserAvatar } from '@/components/ui/user-avatar';
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

  // Filter for active members only (if status property exists)
  const activeMembers = familyMembers.filter(member => 
    !('status' in member) || (member as any).status === 'active'
  );

  const selectedMembers = activeMembers.filter(member => 
    safeSelectedAssignees.includes(member.id)
  );

  const availableMembers = activeMembers.filter(member => 
    !safeSelectedAssignees.includes(member.id)
  );

  const selectAll = () => {
    onAssigneesChange(activeMembers.map(m => m.id));
  };

  const toggleAssignee = (profileId: string) => {
    const newAssignees = safeSelectedAssignees.includes(profileId)
      ? safeSelectedAssignees.filter(id => id !== profileId)
      : [...safeSelectedAssignees, profileId];
    onAssigneesChange(newAssignees);
  };

  const removeAssignee = (profileId: string) => {
    onAssigneesChange(safeSelectedAssignees.filter(id => id !== profileId));
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
              <UserAvatar
                name={member.display_name}
                color={member.color}
                avatarIcon={member.avatar_url || undefined}
                size="sm"
                className="h-6 w-6"
              />
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
              {/* Select all option */}
              <CommandItem
                value="select-all"
                onSelect={() => {
                  selectAll();
                }}
                className="flex items-center gap-2 text-xs text-muted-foreground border-b"
              >
                <span>Select all</span>
              </CommandItem>
              
              {/* Family members */}
              {activeMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.display_name}
                  onSelect={() => toggleAssignee(member.id)}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <UserAvatar
                      name={member.display_name}
                      color={member.color}
                      avatarIcon={member.avatar_url || undefined}
                      size="sm"
                      className="h-8 w-8"
                    />
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