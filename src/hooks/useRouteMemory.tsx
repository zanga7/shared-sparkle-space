import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ROUTE_STORAGE_KEY = 'lastVisitedRoute';

// Routes that should NOT be remembered (auth, onboarding, etc.)
const EXCLUDED_ROUTES = [
  '/auth',
  '/child-auth',
  '/onboarding',
  '/screensaver-preview'
];

export const useRouteMemory = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    
    // Don't save excluded routes
    const isExcluded = EXCLUDED_ROUTES.some(route => path.startsWith(route));
    if (!isExcluded && path !== '/') {
      localStorage.setItem(ROUTE_STORAGE_KEY, path);
    }
    
    // Also save the home route if explicitly on it
    if (path === '/') {
      localStorage.setItem(ROUTE_STORAGE_KEY, path);
    }
  }, [location.pathname]);
};

export const getLastRoute = (): string | null => {
  return localStorage.getItem(ROUTE_STORAGE_KEY);
};

export const clearLastRoute = () => {
  localStorage.removeItem(ROUTE_STORAGE_KEY);
};
