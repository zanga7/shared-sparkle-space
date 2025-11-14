import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useMemberColor } from '@/hooks/useMemberColor';
import { Calendar, Edit } from 'lucide-react';
import { Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { useEvents } from '@/hooks/useEvents';
import { format, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';

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
  
  // Filter events for today and for this member
  const todaysEvents = events.filter(event => {
    const eventDate = new Date(event.start_date);
    return isToday(eventDate) && (
      !event.attendees?.length || 
      event.attendees.some(attendee => attendee.profile_id === member.id)
    );
  });

  return (
    <Card className="h-full flex flex-col" style={colorStyles.bg10}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl" style={colorStyles.text}>
          <Calendar className="h-6 w-6" />
          Today's Events
        </CardTitle>
        
        <AddButton 
          text="Add Event"
          onClick={onAddEvent}
          className="border-dashed hover:border-solid w-full"
          style={{ ...colorStyles.border, ...colorStyles.text }}
        />
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-0">
        {todaysEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground px-3">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No events scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3 px-3">
            {todaysEvents.map((event) => (
              <div 
                key={event.id} 
                className="p-3 border rounded-lg space-y-2 cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => onEditEvent(event)}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{event.title}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(event.start_date), 'HH:mm')}
                    </span>
                    <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                
                {event.location && (
                  <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                )}
                
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
                
                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Attendees:</span>
                    <div className="flex gap-1">
                      {event.attendees.map((attendee) => (
                        <UserAvatar
                          key={attendee.profile_id}
                          name={attendee.profile?.display_name || 'Unknown'}
                          color={attendee.profile?.color}
                          avatarIcon={attendee.profile?.avatar_url || undefined}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};