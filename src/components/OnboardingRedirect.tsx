import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingRedirectProps {
  children: React.ReactNode;
}

export function OnboardingRedirect({ children }: OnboardingRedirectProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { needsOnboarding, loading } = useOnboardingStatus();

  useEffect(() => {
    // Don't redirect if we're already on an onboarding page or auth page
    if (location.pathname.startsWith('/onboarding') || 
        location.pathname.startsWith('/auth') ||
        location.pathname.startsWith('/child-auth')) {
      return;
    }

    // If user is authenticated and needs onboarding, redirect to welcome
    if (user && !loading && needsOnboarding) {
      navigate('/onboarding/welcome');
    }
  }, [user, needsOnboarding, loading, location.pathname, navigate]);

  // Show loading state while checking
  if (loading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
