-- Delete all event attendees first (foreign key dependency)
DELETE FROM public.event_attendees;

-- Delete all event-related recurrence exceptions
DELETE FROM public.recurrence_exceptions WHERE series_type = 'event';

-- Delete all event series
DELETE FROM public.event_series;

-- Delete all regular events
DELETE FROM public.events;