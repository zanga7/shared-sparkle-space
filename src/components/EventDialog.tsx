import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useEvents } from '@/hooks/useEvents';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/event';
import { EventRecurrenceOptions } from '@/types/recurrence';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';
import { EditScopeDialog, EditScope } from '@/components/recurrence/EditScopeDialog';
import { Badge } from '@/components/ui/badge';
import { Repeat } from 'lucide-react';
import { useRecurringSeries } from '@/hooks/useRecurringSeries';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date | null;
  familyId?: string;
  defaultMember?: string;
  event?: CalendarEvent | null;
  familyMembers?: any[];
  onSave?: (eventData: any) => void;
  onDelete?: () => void;
  editingEvent?: CalendarEvent | null;
  defaultDate?: Date;
}