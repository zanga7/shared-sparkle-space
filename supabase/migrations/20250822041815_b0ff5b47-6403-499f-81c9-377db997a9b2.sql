-- Fix foreign key relationships for list_item_assignees
ALTER TABLE list_item_assignees 
DROP CONSTRAINT IF EXISTS list_item_assignees_profile_id_fkey;

ALTER TABLE list_item_assignees 
ADD CONSTRAINT list_item_assignees_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Ensure we have proper categories for shopping and camping
INSERT INTO categories (family_id, name, color, icon, sort_order, created_by, is_active) 
SELECT DISTINCT 
  p.family_id,
  'Shopping',
  'emerald',
  'ShoppingCart',
  0,
  p.id,
  true
FROM profiles p 
WHERE p.role = 'parent' 
AND NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.family_id = p.family_id 
  AND c.name = 'Shopping' 
  AND c.is_active = true
);

INSERT INTO categories (family_id, name, color, icon, sort_order, created_by, is_active) 
SELECT DISTINCT 
  p.family_id,
  'Camping',
  'amber',
  'Tent',
  1,
  p.id,
  true
FROM profiles p 
WHERE p.role = 'parent' 
AND NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.family_id = p.family_id 
  AND c.name = 'Camping' 
  AND c.is_active = true
);

INSERT INTO categories (family_id, name, color, icon, sort_order, created_by, is_active) 
SELECT DISTINCT 
  p.family_id,
  'Custom',
  'sky',
  'List',
  2,
  p.id,
  true
FROM profiles p 
WHERE p.role = 'parent' 
AND NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.family_id = p.family_id 
  AND c.name = 'Custom' 
  AND c.is_active = true
);