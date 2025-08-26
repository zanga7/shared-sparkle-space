import * as React from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Textarea } from "./textarea"
import { Plus, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface EnhancedListInputProps {
  value: string
  onChange: (value: string) => void
  onAddItems: (text: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  existingItems?: string[]
  preventDuplicates?: boolean
  className?: string
  multiline?: boolean
}

export const EnhancedListInput = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, EnhancedListInputProps>(
  ({ 
    value, 
    onChange, 
    onAddItems, 
    placeholder = "Add an item...", 
    disabled = false,
    existingItems = [],
    preventDuplicates = true,
    multiline = false,
    className,
    ...props 
  }, ref) => {
    const { toast } = useToast()
    const [isAdding, setIsAdding] = React.useState(false)
    const [lastBulkAdd, setLastBulkAdd] = React.useState<string[]>([])
    const [showUndo, setShowUndo] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)
    
    React.useImperativeHandle(ref, () => inputRef.current!)

    const processText = (text: string): string[] => {
      if (!text.trim()) return []
      
      // Check for line breaks first (multi-line paste)
      if (text.includes('\n')) {
        return text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
      }
      
      // Check for commas (comma-separated values)
      if (text.includes(',')) {
        return text
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0)
      }
      
      // Single item
      return [text.trim()]
    }

    const filterDuplicates = (items: string[]): { items: string[], skipped: string[] } => {
      if (!preventDuplicates) return { items, skipped: [] }
      
      const existingLower = existingItems.map(item => item.toLowerCase())
      const filtered: string[] = []
      const skipped: string[] = []
      
      items.forEach(item => {
        if (existingLower.includes(item.toLowerCase())) {
          skipped.push(item)
        } else {
          filtered.push(item)
          existingLower.push(item.toLowerCase()) // Prevent duplicates within the batch
        }
      })
      
      return { items: filtered, skipped }
    }

    const handleAdd = async () => {
      if (!value.trim() || isAdding) return
      
      setIsAdding(true)
      try {
        const processedItems = processText(value)
        const { items, skipped } = filterDuplicates(processedItems)
        
        if (items.length === 0) {
          if (skipped.length > 0) {
            toast({
              title: "No items added",
              description: `${skipped.length} duplicate item(s) were skipped.`,
              variant: "default"
            })
          }
          return
        }

        // For bulk adds (multiple items), show undo option
        if (items.length > 1) {
          setLastBulkAdd(items)
          setShowUndo(true)
          setTimeout(() => setShowUndo(false), 5000) // Hide undo after 5 seconds
        }

        // Join items back for the addItems function to parse
        await onAddItems(items.join('\n'))
        onChange('')
        
        // Keep focus on input
        setTimeout(() => {
          inputRef.current?.focus()
        }, 0)

        // Show feedback for bulk adds
        if (items.length > 1) {
          let message = `Added ${items.length} items`
          if (skipped.length > 0) {
            message += `, ${skipped.length} duplicates skipped`
          }
          toast({
            title: "Bulk add complete",
            description: message,
            variant: "default"
          })
        } else if (skipped.length > 0) {
          toast({
            title: "Item added",
            description: `${skipped.length} duplicate item(s) were skipped.`,
            variant: "default"
          })
        }
      } finally {
        setIsAdding(false)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleAdd()
      }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Let the default paste behavior happen first
      setTimeout(() => {
        const pastedText = e.clipboardData.getData('text')
        if (pastedText.includes('\n') || pastedText.includes(',')) {
          // This will be a bulk add, the handleAdd will process it
          handleAdd()
        }
      }, 0)
    }

    const handleUndo = () => {
      // This would need to be implemented by the parent component
      // For now, just hide the undo button
      setShowUndo(false)
      toast({
        title: "Undo",
        description: "Undo functionality would remove the last bulk add.",
        variant: "default"
      })
    }

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex gap-2">
          {multiline ? (
            <Textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled || isAdding}
              className="flex-1 min-h-[80px] resize-y"
              {...props}
            />
          ) : (
            <Input
              ref={inputRef as React.Ref<HTMLInputElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled || isAdding}
              className="flex-1"
              {...props}
            />
          )}
          <Button 
            onClick={handleAdd}
            disabled={!value.trim() || isAdding}
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {showUndo && (
            <Button
              onClick={handleUndo}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {multiline ? "Ctrl/Cmd+Enter to add. Paste multiple lines to bulk add." : "Enter to add. Paste multiple lines to bulk add."}
        </div>
      </div>
    )
  }
)

EnhancedListInput.displayName = "EnhancedListInput"
