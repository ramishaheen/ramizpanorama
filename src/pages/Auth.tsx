import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (user) return <Navigate to="/intel" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    if (isLogin) {
      const res = await signIn(email, password);
      if (res.error) setError(res.error);
    } else {
      const res = await signUp(email, password, displayName);
      if (res.error) setError(res.error);
      else setSuccess("Check your email to confirm your account.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-mono tracking-wider">SENTINEL INTEL</h1>
          </div>
          <p className="text-sm text-muted-foreground">Lawful Public Intelligence Platform</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
          <div className="flex mb-6 border-b border-border">
            <button onClick={() => { setIsLogin(true); setError(""); setSuccess(""); }} className={`flex-1 pb-2 text-sm font-mono uppercase tracking-wider transition-colors ${isLogin ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>Sign In</button>
            <button onClick={() => { setIsLogin(false); setError(""); setSuccess(""); }} className={`flex-1 pb-2 text-sm font-mono uppercase tracking-wider transition-colors ${!isLogin ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-secondary/50" />
            )}
            <Input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="bg-secondary/50" />
            <div className="relative">
              <Input type={showPw ? "text" : "password"} placeholder="Password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="bg-secondary/50 pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            {success && <p className="text-emerald-500 text-xs">{success}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
