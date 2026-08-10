import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/PasswordField';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    // Supabase exchanges the recovery token in the URL for a session as soon
    // as the client loads; by the time this page mounts that may have already
    // happened, so check the current session in addition to listening for the
    // PASSWORD_RECOVERY event.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError(undefined);

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success('Password updated');
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#1a1409] px-6 font-sans">
      <div
        className="w-full max-w-sm rounded-[18px] p-6 text-left backdrop-blur-md sm:p-8"
        style={{
          background: 'rgba(38, 28, 15, 0.55)',
          boxShadow: '0 0 0 1px rgba(240,165,0,0.3), 0 0 45px rgba(240,165,0,0.12), 0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h1 className="text-2xl font-extrabold text-white">Set a new password</h1>
        <p className="mt-1 text-sm text-gray-400">Choose a new password for your account.</p>

        {!ready ? (
          <p className="mt-6 text-sm text-amber-200/80">
            Verifying your reset link… If nothing happens, the link may be invalid or expired — request a new one
            from the login page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <PasswordField id="new-password" value={password} onChange={setPassword} placeholder="New password" />
            <PasswordField
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={error}
              placeholder="Confirm new password"
            />
            <Button
              type="submit"
              disabled={submitting}
              className="w-full text-black shadow-lg transition-transform hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #f0a500, #ffcf5c)',
                boxShadow: '0 10px 30px rgba(240,165,0,0.35)',
              }}
            >
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
