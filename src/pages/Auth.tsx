import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('signin-email') as string;
    const password = formData.get('signin-password') as string;

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: 'Sign In Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('signup-email') as string;
    const password = formData.get('signup-password') as string;
    const displayName = formData.get('display-name') as string;
    const familyName = formData.get('family-name') as string;

    const { error } = await signUp(email, password, {
      display_name: displayName,
      family_name: familyName
    });
    
    if (error) {
      toast({
        title: 'Sign Up Failed',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Account Created!',
        description: 'Please check your email for verification.',
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 w-full">
      <div className="w-full flex flex-col items-center space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl font-bold">Family Chores</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Manage chores and rewards for your family
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="signin-email"
                      type="email"
                      placeholder="parent@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="signin-password"
                      type="password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Your Name</Label>
                    <Input
                      id="display-name"
                      name="display-name"
                      placeholder="Parent Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="family-name">Family Name</Label>
                    <Input
                      id="family-name"
                      name="family-name"
                      placeholder="The Smith Family"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="signup-email"
                      type="email"
                      placeholder="parent@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="signup-password"
                      type="password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Create Family Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Are you a child?
          </p>
          <Button 
            variant="outline" 
            onClick={() => navigate('/child-auth')}
            className="w-full max-w-md"
          >
            Child Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;