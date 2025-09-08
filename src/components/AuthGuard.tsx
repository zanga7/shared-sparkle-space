import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectPath?: string;
  showToast?: boolean;
}

export const AuthGuard = ({ 
  children, 
  requireAuth = true, 
  redirectPath = '/auth',
  showToast = true 
}: AuthGuardProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      if (showToast) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to access this feature.",
          variant: "destructive",
        });
      }
      navigate(redirectPath);
    }
  }, [user, loading, requireAuth, redirectPath, showToast, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return null; // Will redirect
  }

  return <>{children}</>;
};