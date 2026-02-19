import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useMemberColor } from '@/hooks/useMemberColor';
import { Calendar, Edit } from 'lucide-react';
import { Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { useEvents } from '@/hooks/useEvents';
import { format, isToday, isSameDay, startOfDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MemberEventsWidgetProps {
  member: Profile;
  profile: Profile;
  events: any[];
  onAddEvent: () => void;
  onEditEvent: (event: any) => void;
  memberColor?: string;
}

export const MemberEventsWidget = ({
  member,
  profile,
  events,
  onAddEvent,
  onEditEvent,
  memberColor
}: MemberEventsWidgetProps) => {
  const { styles: colorStyles } = useMemberColor(memberColor || member.color);
  
  // Get next 10 upcoming events for this member, grouped by date
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.start_date);
      const today = startOfDay(new Date());
      
      // Only future or today's events
      if (eventDate < today) return false;
      
      // Filter by member attendance
      if (!event.attendees?.length) return true;
      return event.attendees.some(attendee => attendee.profile_id === member.id);
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 10);

  // Group events by date
  const eventsByDate = upcomingEvents.reduce((acc, event) => {
    const dateKey = format(new Date(event.start_date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, typeof upcomingEvents>);

  const dateKeys = Object.keys(eventsByDate).sort();

  // Helper to format date header
  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isSameDay(date, new Date(Date.now() + 86400000))) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  // Helper to get source icon
  const getSourceIcon = (sourceType: string | null | undefined) => {
    if (sourceType === 'google') {
      return (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    }
    if (sourceType === 'microsoft') {
      return (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
        </svg>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col" style={colorStyles.bg10}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl" style={colorStyles.text}>
          <Calendar className="h-6 w-6" />
          Events
        </CardTitle>
        
        <AddButton 
          text="Add Event"
          onClick={onAddEvent}
          className="border-dashed hover:border-solid w-full"
          style={{ ...colorStyles.border, ...colorStyles.text }}
        />
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto">
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No coming events</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                  {formatDateHeader(dateKey)}
                  <Badge variant="secondary" className="text-xs">
                    {eventsByDate[dateKey].length}
                  </Badge>
                </h3>
                <div className="space-y-2">
                  {eventsByDate[dateKey].map((event) => (
                    <div 
                      key={event.id} 
                      className={cn(
                        "p-3 rounded-lg space-y-2 transition-colors group",
                        event.source_type ? "cursor-default" : "cursor-pointer hover:opacity-80"
                      )}
                      style={colorStyles.bg20}
                      onClick={() => !event.source_type && onEditEvent(event)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h4 className="font-medium truncate">{event.title}</h4>
                          {event.source_type && (
                            <div className="flex-shrink-0" title={`Synced from ${event.source_type === 'google' ? 'Google Calendar' : 'Outlook'}`}>
                              {getSourceIcon(event.source_type)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!event.is_all_day && (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(event.start_date), 'HH:mm')}
                            </span>
                          )}
                          {!event.source_type && (
                            <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>
                      
                      {event.location && (
                        <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                      )}
                      
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                      )}
                      
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-muted-foreground">Attendees:</span>
                          <div className="flex gap-1">
                            {event.attendees.slice(0, 5).map((attendee) => (
                              <UserAvatar
                                key={attendee.profile_id}
                                name={attendee.profile?.display_name || 'Unknown'}
                                color={attendee.profile?.color}
                                avatarIcon={attendee.profile?.avatar_url || undefined}
                                size="sm"
                              />
                            ))}
                            {event.attendees.length > 5 && (
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs">
                                +{event.attendees.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};