import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRouteMemory, getLastRoute } from '@/hooks/useRouteMemory';

interface RouteMemoryProviderProps {
  children: React.ReactNode;
}

// Session flag to track if we've already done the initial redirect
const SESSION_REDIRECT_KEY = 'routeMemoryRedirectDone';

export const RouteMemoryProvider = ({ children }: RouteMemoryProviderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasCheckedRef = useRef(false);
  
  // Track route changes (after initial load)
  useRouteMemory();

  useEffect(() => {
    // Only run once on initial app load
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Check if this is a fresh page load (not a navigation within the app)
    const hasRedirectedThisSession = sessionStorage.getItem(SESSION_REDIRECT_KEY);
    
    // Only redirect if:
    // 1. We're on the root path
    // 2. We haven't redirected this session yet
    // 3. There's a saved route that's different from root
    if (location.pathname === '/' && !hasRedirectedThisSession) {
      const lastRoute = getLastRoute();
      
      if (lastRoute && lastRoute !== '/') {
        sessionStorage.setItem(SESSION_REDIRECT_KEY, 'true');
        navigate(lastRoute, { replace: true });
        return;
      }
    }
    
    // Mark that we've checked this session
    sessionStorage.setItem(SESSION_REDIRECT_KEY, 'true');
  }, []); // Empty deps - only run once on mount

  return <>{children}</>;
};
