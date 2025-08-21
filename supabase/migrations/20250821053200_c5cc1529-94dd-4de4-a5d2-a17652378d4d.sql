-- First drop the existing function and recreate it with proper return type
DROP FUNCTION IF EXISTS delete_reward(uuid);

-- Recreate with correct return type
CREATE OR REPLACE FUNCTION delete_reward(reward_id_param UUID)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if reward exists and belongs to user's family
    IF NOT EXISTS (
        SELECT 1 FROM rewards r
        JOIN profiles p ON r.family_id = p.family_id
        WHERE r.id = reward_id_param 
        AND p.user_id = auth.uid()
    ) THEN
        RETURN QUERY SELECT FALSE, 'Reward not found or access denied'::TEXT, ''::TEXT;
        RETURN;
    END IF;

    -- Delete the reward
    DELETE FROM rewards WHERE id = reward_id_param;
    
    RETURN QUERY SELECT TRUE, ''::TEXT, 'Reward deleted successfully'::TEXT;
END;
$$;