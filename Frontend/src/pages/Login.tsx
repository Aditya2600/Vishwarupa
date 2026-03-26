import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { requestJson } from '@/lib/api';

function getFriendlyLoginErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (normalizedMessage.includes('401') || normalizedMessage.includes('invalid credentials')) {
    return 'Email or password is incorrect.';
  }

  return null;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email.trim().toLowerCase());
      formData.append('password', password);

      const data = await requestJson<{
        access_token: string;
        email?: string;
        full_name?: string | null;
        is_admin?: boolean;
      }>('/auth/login', {
        method: 'POST',
        body: formData,
      });

      if (data.is_admin) {
        toast({
          title: 'Access Denied',
          description: 'Admin accounts must login through the secure admin link.',
          variant: 'destructive',
        });
        return;
      }

      login(data.access_token, {
        email: data.email ?? email.trim().toLowerCase(),
        fullName: typeof data.full_name === 'string' && data.full_name.trim() ? data.full_name.trim() : null,
        isAdmin: false,
      });
      toast({ title: 'Login Successful', description: 'Welcome back!', duration: 3000 });
      navigate('/');

    } catch (error) {
      const description = getFriendlyLoginErrorMessage(error);
      toast({
        title: 'Login Failed',
        description: description ?? undefined,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-2 border-slate-200 dark:border-slate-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <Link to="/">
              <img src="/logo.png" alt="Company Logo" className="h-16 object-contain hover:opacity-80 transition-opacity" />
            </Link>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Sign In
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Sign in with your email and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
                className="bg-white dark:bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="bg-white dark:bg-slate-900"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-6"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-slate-900 dark:text-slate-50 font-semibold hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
