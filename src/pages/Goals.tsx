import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Goals is now integrated into the main dashboard
// This page redirects there for backwards compatibility
export default function Goals() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to main dashboard - the Goals tab is accessible there
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
