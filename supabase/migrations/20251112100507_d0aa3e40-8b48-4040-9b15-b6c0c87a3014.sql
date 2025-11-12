
-- Fix points data integrity issue
-- Recalculate all profile total_points based on points_ledger

DO $$
DECLARE
  profile_rec RECORD;
  correct_total INTEGER;
BEGIN
  -- Loop through all profiles and recalculate their points
  FOR profile_rec IN SELECT id, family_id, display_name, total_points FROM profiles
  LOOP
    -- Calculate the correct total from ledger
    SELECT COALESCE(SUM(points), 0) INTO correct_total
    FROM points_ledger
    WHERE profile_id = profile_rec.id;
    
    -- Update if different
    IF profile_rec.total_points != correct_total THEN
      RAISE NOTICE 'Fixing % points: % -> %', 
        profile_rec.display_name, 
        profile_rec.total_points, 
        correct_total;
        
      UPDATE profiles
      SET total_points = GREATEST(correct_total, 0),  -- Never go below 0
          updated_at = now()
      WHERE id = profile_rec.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Points recalculation complete';
END $$;
