import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, LogIn } from 'lucide-react';

interface AuthPromptProps {
  title?: string;
  description?: string;
  action?: string;
}

export const AuthPrompt = ({ 
  title = "Authentication Required",
  description = "Please sign in to access this feature.",
  action = "Sign In"
}: AuthPromptProps) => {
  const navigate = useNavigate();

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <UserPlus className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          onClick={() => navigate('/auth')}
          className="w-full"
        >
          <LogIn className="w-4 h-4 mr-2" />
          {action}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          New to Family Chores? You can sign up for a new account on the sign-in page.
        </p>
      </CardContent>
    </Card>
  );
};