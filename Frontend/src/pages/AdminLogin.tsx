import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (!data.is_admin) {
          toast.error("Access Denied: You do not have administrator privileges.");
          setIsLoading(false);
          return;
        }

        login(data.access_token, {
          email: data.email,
          fullName: data.full_name,
          isAdmin: true,
        });

        localStorage.setItem("is_admin", "true");
        toast.success("Identity Verified. Welcome back, Supervisor.");
        navigate("/admin");
      } else {
        toast.error(data.detail || "Authentication failed. Please check your credentials.");
      }
    } catch {
      toast.error("System error. Please verify backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-2 border-slate-200">
        <CardHeader className="text-center">
          {/* Logo — same as Login.tsx */}
          <div className="flex justify-center mb-6">
            <Link to="/login">
              <img
                src="/logo.png"
                alt="Company Logo"
                className="h-16 object-contain hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>

          {/* Admin badge */}
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[11px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Portal
            </span>
          </div>

          <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
            Admin Sign In
          </CardTitle>
          <CardDescription className="text-slate-500">
            Sign in with your administrator credentials
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Email</label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@credresolve.com"
                autoComplete="email"
                required
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Password</label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="bg-white"
              />
            </div>
            <Button
              id="admin-login-submit"
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...</>
              ) : (
                "Sign In to Admin"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-center text-sm text-slate-500">
            Not an admin?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Return to User Portal
            </Link>
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <ShieldCheck className="w-3 h-3 text-slate-300" />
            <span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">
              Encrypted Admin Session
            </span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminLogin;
