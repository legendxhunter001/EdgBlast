import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from '@/components/Logo';
import { GoogleIcon } from '@/components/GoogleIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { TrendingUp, BarChart3, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';

const Auth = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const nextPath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);

  if (session) return <Navigate to={nextPath} replace />;

  const applyRemember = () => {
    if (remember) {
      localStorage.setItem('eb-remember', '1');
    } else {
      localStorage.setItem('eb-remember', '0');
      sessionStorage.setItem('eb-session-only', '1');
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    applyRemember();
    toast.success('Welcome back');
    navigate(nextPath);
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + nextPath,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    applyRemember();
    toast.success('Account created — you are signed in');
    navigate(nextPath);
  };

  // Independent build: plain Supabase Google OAuth (requires Google Client ID/Secret
  // configured in this project's Supabase Auth settings) — the live app's Lovable-hosted
  // OAuth broker only works inside Lovable Cloud, so it can't be used here.
  const handleGoogle = async () => {
    setGoogleLoading(true);
    applyRemember();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + nextPath },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error('Could not sign in with Google');
    }
    // On success, Supabase redirects the browser to Google — no further action here.
  };

  const handleForgot = async () => {
    if (!email) return toast.error('Enter your email above first');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success('Password reset link sent — check your inbox');
    setForgotOpen(false);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      <div className="absolute top-4 right-4 z-20"><ThemeToggle /></div>

      <aside className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative flex-col justify-between p-12 bg-gradient-luxe text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(800px circle at 20% 20%, hsl(var(--primary) / 0.35), transparent 60%), radial-gradient(700px circle at 80% 80%, hsl(var(--accent) / 0.25), transparent 60%)' }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3">
            <Logo size={44} />
            <div>
              <div className="font-display font-bold text-xl leading-none">Edge Blast</div>
              <div className="text-[10px] uppercase tracking-widest text-white/60 mt-1">Trading Journal</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8 max-w-md">
          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight">Refine your edge.<br/>Trade with clarity.</h2>
            <p className="text-white/70 mt-4 text-base leading-relaxed">
              A premium journal for serious traders. Log every trade, review with screenshots, and uncover the patterns that grow your edge.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Feature icon={<TrendingUp className="size-4" />} label="Performance analytics" />
            <Feature icon={<BarChart3 className="size-4" />} label="Edge discovery" />
            <Feature icon={<CalendarIcon className="size-4" />} label="Daily P&L calendar" />
            <Feature icon={<ShieldCheck className="size-4" />} label="Private & secure" />
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/50">
          © {new Date().getFullYear()} Edge Blast — Built for disciplined traders.
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative">
        <div className="absolute inset-0 bg-gradient-glow pointer-events-none lg:hidden" />
        <div className="relative w-full max-w-md">
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center gap-3">
              <Logo size={40} />
              <div className="text-left">
                <div className="font-display font-bold text-lg leading-none">Edge Blast</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Trading Journal</div>
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="font-display text-2xl md:text-3xl font-semibold">Welcome</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Sign in to continue to your journal</p>
          </div>

          <div className="luxe-card p-6 md:p-7 space-y-5">
            <Button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              variant="outline"
              className="w-full h-11 bg-card hover:bg-secondary/60 border-border font-medium text-foreground gap-3 tap"
            >
              <GoogleIcon />
              {googleLoading ? 'Connecting…' : 'Continue with Google'}
            </Button>

            <div className="relative flex items-center">
              <div className="flex-1 hairline" />
              <span className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">or</span>
              <div className="flex-1 hairline" />
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2 mb-5">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-0">
                {forgotOpen ? (
                  <div className="space-y-4 animate-fade-up">
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@trader.com" />
                      <p className="text-xs text-muted-foreground">We'll send a secure reset link.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" className="flex-1" onClick={() => setForgotOpen(false)}>Back</Button>
                      <Button type="button" className="flex-1" onClick={handleForgot}>Send reset link</Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@trader.com" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Password</Label>
                        <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-primary hover:underline">Forgot?</button>
                      </div>
                      <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <Checkbox checked={remember} onCheckedChange={(c) => setRemember(!!c)} />
                      Remember me on this device
                    </label>
                    <Button type="submit" disabled={loading} className="w-full h-11">
                      {loading ? 'Signing in…' : 'Sign in'}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Display name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Trader" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@trader.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Checkbox checked={remember} onCheckedChange={(c) => setRemember(!!c)} />
                    Keep me signed in
                  </label>
                  <Button type="submit" disabled={loading} className="w-full h-11">
                    {loading ? 'Creating…' : 'Create account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 px-4">
            By continuing you agree to journal responsibly. Edge Blast does not execute trades or connect to brokers.
          </p>
        </div>
      </main>
    </div>
  );
};

const Feature = ({ icon, label }: { icon: ReactNode; label: string }) => (
  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
    <div className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-white/80">{icon}</div>
    <span className="text-sm text-white/85 font-medium">{label}</span>
  </div>
);

export default Auth;
