import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRouteMemory, getLastRoute } from '@/hooks/useRouteMemory';

interface RouteMemoryProviderProps {
  children: React.ReactNode;
}

export const RouteMemoryProvider = ({ children }: RouteMemoryProviderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);
  
  // Track route changes
  useRouteMemory();

  useEffect(() => {
    // Only redirect on initial load, when on the root path
    if (!hasRedirected && location.pathname === '/') {
      const lastRoute = getLastRoute();
      
      // If there's a saved route and it's different from current
      if (lastRoute && lastRoute !== '/') {
        setHasRedirected(true);
        navigate(lastRoute, { replace: true });
        return;
      }
    }
    
    setHasRedirected(true);
  }, [location.pathname, navigate, hasRedirected]);

  return <>{children}</>;
};
