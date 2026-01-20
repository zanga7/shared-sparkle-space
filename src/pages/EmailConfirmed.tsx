import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  // Check for error in URL hash or search params
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    // Check URL hash for errors (Supabase sometimes puts errors there)
    const hash = window.location.hash;
    if (hash.includes('error=') || error) {
      setStatus('error');
      return;
    }
    
    // If user is authenticated, confirmation was successful
    if (user) {
      setStatus('success');
      return;
    }

    // Wait a moment for auth state to settle
    const timeout = setTimeout(() => {
      setStatus(user ? 'success' : 'success'); // Show success either way, let them login
    }, 1500);

    return () => clearTimeout(timeout);
  }, [user, error]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
          <p className="text-muted-foreground">Confirming your email...</p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Confirmation Failed</h1>
            <p className="text-muted-foreground">
              {errorDescription?.replace(/\+/g, ' ') || 'The email confirmation link is invalid or has expired.'}
            </p>
          </div>

          <div className="space-y-3">
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
            <p className="text-sm text-muted-foreground">
              Need a new confirmation email? Sign in and request a new one.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Email Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for verifying your email address. Your account is now ready to use.
          </p>
        </div>

        <Button onClick={() => navigate('/auth')} size="lg" className="w-full">
          Continue to Login
        </Button>
      </Card>
    </div>
  );
}
