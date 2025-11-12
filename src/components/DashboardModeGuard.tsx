import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardMode } from '@/hooks/useDashboardMode';
import { useToast } from '@/hooks/use-toast';

interface DashboardModeGuardProps {
  children: React.ReactNode;
}

export function DashboardModeGuard({ children }: DashboardModeGuardProps) {
  const { dashboardModeEnabled, loading } = useDashboardMode();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !dashboardModeEnabled) {
      toast({
        title: 'Access Restricted',
        description: 'This page is only available when Dashboard Mode is enabled. Please use member-specific views.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [dashboardModeEnabled, loading, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!dashboardModeEnabled) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
