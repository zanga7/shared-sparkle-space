-- Create lists table
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT NOT NULL DEFAULT 'custom',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create list_items table
CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  quantity INTEGER DEFAULT 1,
  category TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create list_item_assignees table (similar to task_assignees)
CREATE TABLE public.list_item_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_item_id UUID NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create list_templates table for shopping/camping templates
CREATE TABLE public.list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID,
  name TEXT NOT NULL,
  list_type TEXT NOT NULL,
  template_items JSONB NOT NULL DEFAULT '[]',
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_item_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for lists
CREATE POLICY "Family members can view lists" 
ON public.lists FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = lists.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Family members can manage lists" 
ON public.lists FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = lists.family_id 
  AND profiles.user_id = auth.uid()
));

-- RLS policies for list_items
CREATE POLICY "Family members can view list items" 
ON public.list_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM lists l
  JOIN profiles p ON p.family_id = l.family_id
  WHERE l.id = list_items.list_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Family members can manage list items" 
ON public.list_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM lists l
  JOIN profiles p ON p.family_id = l.family_id
  WHERE l.id = list_items.list_id 
  AND p.user_id = auth.uid()
));

-- RLS policies for list_item_assignees
CREATE POLICY "Family members can view list item assignments" 
ON public.list_item_assignees FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM list_items li
  JOIN lists l ON l.id = li.list_id
  JOIN profiles p ON p.family_id = l.family_id
  WHERE li.id = list_item_assignees.list_item_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Family members can manage list item assignments" 
ON public.list_item_assignees FOR ALL 
USING (EXISTS (
  SELECT 1 FROM list_items li
  JOIN lists l ON l.id = li.list_id
  JOIN profiles p ON p.family_id = l.family_id
  WHERE li.id = list_item_assignees.list_item_id 
  AND p.user_id = auth.uid()
));

-- RLS policies for list_templates
CREATE POLICY "Family members can view templates" 
ON public.list_templates FOR SELECT 
USING (
  is_global = true OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.family_id = list_templates.family_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can manage family templates" 
ON public.list_templates FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = list_templates.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Add triggers for updated_at
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_list_items_updated_at
  BEFORE UPDATE ON public.list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_list_templates_updated_at
  BEFORE UPDATE ON public.list_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert global templates for shopping and camping
INSERT INTO public.list_templates (name, list_type, template_items, is_global) VALUES
('Basic Shopping List', 'shopping', '[
  {"name": "Fruits & Vegetables", "category": "produce", "items": ["Bananas", "Apples", "Lettuce", "Tomatoes"]},
  {"name": "Pantry", "category": "pantry", "items": ["Bread", "Milk", "Eggs", "Cereal"]},
  {"name": "Toiletries", "category": "toiletries", "items": ["Toothpaste", "Shampoo", "Soap"]}
]', true),
('Camping Essentials', 'camping', '[
  {"name": "Tent & Bedding", "category": "shelter", "items": ["Tent", "Sleeping bags", "Pillows", "Blankets"]},
  {"name": "Cooking", "category": "cooking", "items": ["Camping stove", "Matches", "Cookware", "Plates", "Utensils"]},
  {"name": "Safety & Tools", "category": "safety", "items": ["First aid kit", "Flashlight", "Rope", "Multi-tool"]}
]', true);