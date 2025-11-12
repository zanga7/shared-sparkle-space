-- Create holiday_dates table for managing school holidays
CREATE TABLE public.holiday_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable Row Level Security
ALTER TABLE public.holiday_dates ENABLE ROW LEVEL SECURITY;

-- Family members can view holiday dates
CREATE POLICY "Family members can view holiday dates"
ON public.holiday_dates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.family_id = holiday_dates.family_id
    AND profiles.user_id = auth.uid()
  )
);

-- Parents can manage holiday dates
CREATE POLICY "Parents can manage holiday dates"
ON public.holiday_dates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.family_id = holiday_dates.family_id
    AND profiles.user_id = auth.uid()
    AND profiles.role = 'parent'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.family_id = holiday_dates.family_id
    AND profiles.user_id = auth.uid()
    AND profiles.role = 'parent'
  )
);

-- Create index for efficient lookups
CREATE INDEX idx_holiday_dates_family_id ON public.holiday_dates(family_id);
CREATE INDEX idx_holiday_dates_date_range ON public.holiday_dates(start_date, end_date);

-- Add trigger for updated_at
CREATE TRIGGER update_holiday_dates_updated_at
BEFORE UPDATE ON public.holiday_dates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();