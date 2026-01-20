import * as React from "react"
import { useState } from "react"
import { format, addMinutes, addDays, startOfDay, endOfDay, isSameDay, isAfter, isBefore } from "date-fns"
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface DateTimePickerProps {
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

const DURATION_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "1 hr", minutes: 60 },
  { label: "1.5 hrs", minutes: 90 },
  { label: "2 hrs", minutes: 120 },
]

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

export function DateTimePicker({
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
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState(60)
  const [hasEndTime, setHasEndTime] = useState(true)
  const [isMultiDay, setIsMultiDay] = useState(!isSameDay(startDate, endDate))

  const timeOptions = generateTimeOptions()

  const formatChipLabel = () => {
    const isMultiDay = !isSameDay(startDate, endDate)
    const startFormatted = format(startDate, isMultiDay ? 'E d MMM' : 'E d MMM')
    const endFormatted = format(endDate, 'E d MMM')

    if (isAllDay) {
      if (isMultiDay) {
        return `${startFormatted} – ${endFormatted}, All day`
      }
      return `${startFormatted}, All day`
    }

    if (!hasEndTime) {
      return `${startFormatted}, ${format(new Date(`2000-01-01T${startTime}`), 'h:mm a')}`
    }

    const startTimeFormatted = format(new Date(`2000-01-01T${startTime}`), 'h:mm a')
    const endTimeFormatted = format(new Date(`2000-01-01T${endTime}`), 'h:mm a')

    if (isMultiDay) {
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
      const endTime = format(addMinutes(new Date(`2000-01-01T${preset.time}`), selectedDuration), 'HH:mm')
      onEndTimeChange(endTime)
    }
  }

  const handleDurationChange = (minutes: number) => {
    setSelectedDuration(minutes)
    if (hasEndTime) {
      const endTime = format(addMinutes(new Date(`2000-01-01T${startTime}`), minutes), 'HH:mm')
      onEndTimeChange(endTime)
    }
  }

  const handleStartTimeChange = (newStartTime: string) => {
    onStartTimeChange(newStartTime)
    if (hasEndTime) {
      const endTime = format(addMinutes(new Date(`2000-01-01T${newStartTime}`), selectedDuration), 'HH:mm')
      onEndTimeChange(endTime)
    }
  }

  const handleAllDayToggle = (checked: boolean) => {
    onAllDayChange(checked)
    if (checked) {
      // Set to start and end of day
      onStartDateChange(startOfDay(startDate))
      onEndDateChange(endOfDay(endDate))
    }
  }

  const handleNoEndTimeToggle = (checked: boolean) => {
    setHasEndTime(!checked)
  }

  const validateAndFixDates = () => {
    // If end is before start, swap them
    if (isBefore(endDate, startDate)) {
      onEndDateChange(startDate)
    }
  }

  React.useEffect(() => {
    validateAndFixDates()
  }, [startDate, endDate])

  React.useEffect(() => {
    setIsMultiDay(!isSameDay(startDate, endDate))
  }, [startDate, endDate])

  return (
    <div className={cn("w-full", className)}>
      <Label>When</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal min-h-[44px] text-sm",
              !startDate && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {startDate ? formatChipLabel() : "Click to select date and time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] overflow-y-auto p-0" 
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={16}
        >
          <div className="p-4 space-y-4">
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
              {!isMultiDay ? (
                <>
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        onStartDateChange(date)
                        onEndDateChange(date)
                      }
                    }}
                    className="pointer-events-auto"
                  />
                  {startDate && (
                    <Badge variant="secondary" className="mt-2 w-full justify-center">
                      Selected: {format(startDate, 'EEEE, MMM d, yyyy')}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Label className="text-xs text-muted-foreground mb-2 block">Select date range</Label>
                  <CalendarComponent
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                      if (range?.from) {
                        onStartDateChange(range.from)
                        onEndDateChange(range.to || range.from)
                      }
                    }}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                  {startDate && endDate && !isSameDay(startDate, endDate) && (
                    <Badge variant="secondary" className="mt-2 w-full justify-center">
                      {format(startDate, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="multi-day"
                  checked={isMultiDay}
                  onCheckedChange={(checked) => {
                    setIsMultiDay(checked)
                    if (!checked) {
                      // When switching to single-day, collapse end to start
                      onEndDateChange(startDate)
                    }
                  }}
                />
                <Label htmlFor="multi-day" className="text-sm">Multi-day event</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="all-day"
                  checked={isAllDay}
                  onCheckedChange={handleAllDayToggle}
                />
                <Label htmlFor="all-day" className="text-sm">All day</Label>
              </div>
              
              {!isAllDay && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="no-end-time"
                    checked={!hasEndTime}
                    onCheckedChange={handleNoEndTimeToggle}
                  />
                  <Label htmlFor="no-end-time" className="text-sm">No end time</Label>
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
                          variant="outline"
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

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Reset to defaults
                  const now = new Date()
                  const nextQuarter = getNextQuarterHour()
                  onStartDateChange(now)
                  onEndDateChange(now)
                  onStartTimeChange(nextQuarter)
                  onEndTimeChange(format(addMinutes(new Date(`2000-01-01T${nextQuarter}`), 60), 'HH:mm'))
                  onAllDayChange(false)
                  setHasEndTime(true)
                }}
              >
                Clear
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
