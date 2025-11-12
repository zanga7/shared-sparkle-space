-- Enable realtime for profiles table to broadcast points updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;