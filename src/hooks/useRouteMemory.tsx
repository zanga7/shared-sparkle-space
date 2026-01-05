import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_STORAGE_KEY = 'lastVisitedRoute';

// Routes that should NOT be remembered (auth, onboarding, admin, etc.)
const EXCLUDED_ROUTES = [
  '/auth',
  '/child-auth',
  '/onboarding',
  '/screensaver-preview',
  '/admin',
  '/super-admin'
];

export const useRouteMemory = () => {
  const location = useLocation();
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip saving on initial mount to avoid overwriting before redirect check
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const path = location.pathname;
    
    // Don't save excluded routes
    const isExcluded = EXCLUDED_ROUTES.some(route => path.startsWith(route));
    if (!isExcluded) {
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
