import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token=')) {
      setReady(true);
    } else {
      supabase.auth.getSession().then(({ data }) => {
        setReady(!!data.session);
        if (!data.session) toast.error('Invalid or expired reset link');
      });
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (password !== confirm) return toast.error('Passwords do not match');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Password updated — you are signed in');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3">
            <Logo size={40} />
            <div className="text-left">
              <div className="font-display font-bold text-lg leading-none">Edge Blast</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Trading Journal</div>
            </div>
          </div>
        </div>
        <div className="luxe-card p-6 md:p-7">
          <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-5">Choose a strong password to secure your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" disabled={!ready} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} placeholder="Re-enter password" disabled={!ready} />
            </div>
            <Button type="submit" disabled={loading || !ready} className="w-full h-11">
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
