-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('parent', 'child');

-- Create families table
CREATE TABLE public.families (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'child',
    avatar_url TEXT,
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 10,
    is_repeating BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task completions table
CREATE TABLE public.task_completions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for families
CREATE POLICY "Family members can view their family" 
    ON public.families FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.family_id = families.id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Parents can update their family" 
    ON public.families FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.family_id = families.id 
            AND profiles.user_id = auth.uid() 
            AND profiles.role = 'parent'
        )
    );

-- Create RLS policies for profiles
CREATE POLICY "Users can view family members" 
    ON public.profiles FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p2 
            WHERE p2.family_id = profiles.family_id 
            AND p2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Parents can update family member profiles" 
    ON public.profiles FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p2 
            WHERE p2.family_id = profiles.family_id 
            AND p2.user_id = auth.uid() 
            AND p2.role = 'parent'
        )
    );

-- Create RLS policies for tasks
CREATE POLICY "Family members can view family tasks" 
    ON public.tasks FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.family_id = tasks.family_id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Parents can create and manage tasks" 
    ON public.tasks FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.family_id = tasks.family_id 
            AND profiles.user_id = auth.uid() 
            AND profiles.role = 'parent'
        )
    );

-- Create RLS policies for task completions
CREATE POLICY "Family members can view completions" 
    ON public.task_completions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks 
            JOIN public.profiles ON profiles.family_id = tasks.family_id
            WHERE tasks.id = task_completions.task_id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can complete tasks" 
    ON public.task_completions FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = task_completions.completed_by 
            AND profiles.user_id = auth.uid()
        )
    );

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_families_updated_at
    BEFORE UPDATE ON public.families
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    family_name TEXT;
BEGIN
    -- Extract family name from metadata or use default
    family_name := COALESCE(NEW.raw_user_meta_data ->> 'family_name', 'New Family');
    
    -- Create family first (only if this is the first user)
    -- For now, create a new family for each signup - we'll handle family joining later
    INSERT INTO public.families (name) 
    VALUES (family_name);
    
    -- Create profile
    INSERT INTO public.profiles (user_id, family_id, display_name, role)
    VALUES (
        NEW.id, 
        (SELECT id FROM public.families WHERE name = family_name ORDER BY created_at DESC LIMIT 1),
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
        'parent'::public.user_role
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE OR replace TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();