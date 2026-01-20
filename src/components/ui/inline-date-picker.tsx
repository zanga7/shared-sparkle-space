import * as React from "react"
import { useState } from "react"
import { format, addMinutes, addDays, isSameDay, isBefore, startOfDay, endOfDay } from "date-fns"
import { Calendar as CalendarIcon, Clock, ChevronDown, ChevronUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Simple date-only picker props
interface SimpleDatePickerProps {
  date: Date | null
  onDateChange: (date: Date | null) => void
  label?: string
  placeholder?: string
  className?: string
  showClear?: boolean
}

// Full date-time picker props (for events)
interface DateTimePickerInlineProps {
  startDate: Date
  endDate: Date
  startTime: string
  endTime: string
  isAllDay: boolean
  onStartDateChange: (date: Date) => void
  onEndDateChange: (date: Date) => void
  onStartTimeChange: (time: string) => void
  onEndTimeChange: (time: string) => void
  onAllDayChange: (isAllDay: boolean) => void
  className?: string
}

const getNextQuarterHour = () => {
  const now = new Date()
  const minutes = now.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15
  return format(addMinutes(startOfDay(now), roundedMinutes + now.getHours() * 60), 'HH:mm')
}

const generateTimeOptions = () => {
  const times = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = format(new Date(2000, 0, 1, hour, minute), 'HH:mm')
      const display = format(new Date(2000, 0, 1, hour, minute), 'h:mm a')
      times.push({ value: time, display })
    }
  }
  return times
}

const DATE_PRESETS = [
  { label: "Today", getDate: () => new Date() },
  { label: "Tomorrow", getDate: () => addDays(new Date(), 1) },
  { label: "This weekend", getDate: () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysUntilSaturday = (6 - dayOfWeek) % 7
    return addDays(now, daysUntilSaturday === 0 ? 0 : daysUntilSaturday)
  }},
  { label: "Next week", getDate: () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysUntilMonday = (8 - dayOfWeek) % 7
    return addDays(now, daysUntilMonday === 0 ? 7 : daysUntilMonday)
  }},
]

const TIME_PRESETS = [
  { label: "Morning", time: "09:00" },
  { label: "After school", time: "15:30" },
  { label: "Evening", time: "19:00" },
]

const DURATION_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "1 hr", minutes: 60 },
  { label: "1.5 hrs", minutes: 90 },
  { label: "2 hrs", minutes: 120 },
]

/**
 * Simple inline date picker for tasks and goals
 */
export function InlineDatePicker({
  date,
  onDateChange,
  label = "Date",
  placeholder = "Select date",
  className,
  showClear = true
}: SimpleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex gap-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-between text-left font-normal min-h-[44px]",
                !date && "text-muted-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {date ? format(date, "PPP") : placeholder}
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          {showClear && date && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onDateChange(null)}
              title="Clear date"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <CollapsibleContent className="mt-2">
          <div className="border rounded-lg p-3 bg-card space-y-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDateChange(preset.getDate())
                    setIsOpen(false)
                  }}
                  className="h-8 text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            <Separator />
            
            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date || undefined}
                onSelect={(selected) => {
                  onDateChange(selected || null)
                  setIsOpen(false)
                }}
                className="pointer-events-auto p-0"
              />
            </div>
            
            {date && (
              <Badge variant="secondary" className="w-full justify-center">
                Selected: {format(date, 'EEEE, MMM d, yyyy')}
              </Badge>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * Full date-time picker for events with inline expansion
 */
export function DateTimePickerInline({
  startDate,
  endDate,
  startTime,
  endTime,
  isAllDay,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onAllDayChange,
  className,
}: DateTimePickerInlineProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState(60)
  const [hasEndTime, setHasEndTime] = useState(true)
  const [isMultiDay, setIsMultiDay] = useState(!isSameDay(startDate, endDate))

  const timeOptions = generateTimeOptions()

  const formatChipLabel = () => {
    const multiDay = !isSameDay(startDate, endDate)
    const startFormatted = format(startDate, 'E d MMM')
    const endFormatted = format(endDate, 'E d MMM')

    if (isAllDay) {
      if (multiDay) {
        return `${startFormatted} – ${endFormatted}, All day`
      }
      return `${startFormatted}, All day`
    }

    if (!hasEndTime) {
      return `${startFormatted}, ${format(new Date(`2000-01-01T${startTime}`), 'h:mm a')}`
    }

    const startTimeFormatted = format(new Date(`2000-01-01T${startTime}`), 'h:mm a')
    const endTimeFormatted = format(new Date(`2000-01-01T${endTime}`), 'h:mm a')

    if (multiDay) {
      return `${startFormatted}, ${startTimeFormatted} – ${endFormatted}, ${endTimeFormatted}`
    }

    return `${startFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`
  }

  const handleDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    const date = preset.getDate()
    onStartDateChange(date)
    if (!isMultiDay) {
      onEndDateChange(date)
    }
  }

  const handleTimePreset = (preset: typeof TIME_PRESETS[0]) => {
    onStartTimeChange(preset.time)
    if (hasEndTime) {
      const newEndTime = format(addMinutes(new Date(`2000-01-01T${preset.time}`), selectedDuration), 'HH:mm')
      onEndTimeChange(newEndTime)
    }
  }

  const handleDurationChange = (minutes: number) => {
    setSelectedDuration(minutes)
    if (hasEndTime) {
      const newEndTime = format(addMinutes(new Date(`2000-01-01T${startTime}`), minutes), 'HH:mm')
      onEndTimeChange(newEndTime)
    }
  }

  const handleStartTimeChange = (newStartTime: string) => {
    onStartTimeChange(newStartTime)
    if (hasEndTime) {
      const newEndTime = format(addMinutes(new Date(`2000-01-01T${newStartTime}`), selectedDuration), 'HH:mm')
      onEndTimeChange(newEndTime)
    }
  }

  const handleAllDayToggle = (checked: boolean) => {
    onAllDayChange(checked)
    if (checked) {
      onStartDateChange(startOfDay(startDate))
      onEndDateChange(endOfDay(endDate))
    }
  }

  React.useEffect(() => {
    if (isBefore(endDate, startDate)) {
      onEndDateChange(startDate)
    }
  }, [startDate, endDate, onEndDateChange])

  React.useEffect(() => {
    setIsMultiDay(!isSameDay(startDate, endDate))
  }, [startDate, endDate])

  return (
    <div className={cn("space-y-2", className)}>
      <Label>When</Label>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between text-left font-normal min-h-[44px]",
              !startDate && "text-muted-foreground"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{formatChipLabel()}</span>
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <div className="border rounded-lg p-3 sm:p-4 bg-card space-y-4">
            {/* Quick Presets */}
            <div>
              <h4 className="text-sm font-medium mb-2">Quick actions</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDatePreset(preset)}
                    className="h-8 text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {TIME_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTimePreset(preset)}
                    className="h-8 text-xs"
                    disabled={isAllDay}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Calendar */}
            <div>
              <h4 className="text-sm font-medium mb-2">Dates</h4>
              <div className="flex justify-center overflow-x-auto">
                {!isMultiDay ? (
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        onStartDateChange(date)
                        onEndDateChange(date)
                      }
                    }}
                    className="pointer-events-auto p-0"
                  />
                ) : (
                  <Calendar
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                      if (range?.from) {
                        onStartDateChange(range.from)
                        onEndDateChange(range.to || range.from)
                      }
                    }}
                    numberOfMonths={1}
                    className="pointer-events-auto p-0"
                  />
                )}
              </div>
              {startDate && (
                <Badge variant="secondary" className="mt-2 w-full justify-center text-xs">
                  {isMultiDay && !isSameDay(startDate, endDate) 
                    ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`
                    : format(startDate, 'EEEE, MMM d, yyyy')
                  }
                </Badge>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="inline-multi-day"
                  checked={isMultiDay}
                  onCheckedChange={(checked) => {
                    setIsMultiDay(checked)
                    if (!checked) {
                      onEndDateChange(startDate)
                    }
                  }}
                />
                <Label htmlFor="inline-multi-day" className="text-sm">Multi-day event</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="inline-all-day"
                  checked={isAllDay}
                  onCheckedChange={handleAllDayToggle}
                />
                <Label htmlFor="inline-all-day" className="text-sm">All day</Label>
              </div>
              
              {!isAllDay && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="inline-no-end-time"
                    checked={!hasEndTime}
                    onCheckedChange={(checked) => setHasEndTime(!checked)}
                  />
                  <Label htmlFor="inline-no-end-time" className="text-sm">No end time</Label>
                </div>
              )}
            </div>

            {/* Time Pickers */}
            {!isAllDay && (
              <div>
                <h4 className="text-sm font-medium mb-2">Times</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start</Label>
                    <select
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-md bg-background min-h-[44px]"
                    >
                      {timeOptions.map((time) => (
                        <option key={time.value} value={time.value}>
                          {time.display}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasEndTime && (
                    <div>
                      <Label className="text-xs text-muted-foreground">End</Label>
                      <select
                        value={endTime}
                        onChange={(e) => onEndTimeChange(e.target.value)}
                        className="w-full p-2 text-sm border rounded-md bg-background min-h-[44px]"
                      >
                        {timeOptions.map((time) => (
                          <option key={time.value} value={time.value}>
                            {time.display}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Duration Presets */}
                {hasEndTime && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {DURATION_PRESETS.map((duration) => (
                        <Button
                          key={duration.minutes}
                          variant={selectedDuration === duration.minutes ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => handleDurationChange(duration.minutes)}
                          className="h-8 text-xs"
                        >
                          {duration.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Done Button */}
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setIsOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
