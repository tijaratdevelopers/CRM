import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Shuffle, Megaphone } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const HIGHLIGHTS = [
  { icon: Shuffle, label: 'Automatic lead distribution', desc: 'Round-robin engine shares every lead fairly across teams' },
  { icon: Megaphone, label: 'Meta Ads & WhatsApp ready', desc: 'Leads flow straight from your campaigns into the pipeline' },
  { icon: ShieldCheck, label: 'Role-based security', desc: 'Admin, team lead and staff — each sees exactly their work' },
];

function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div
      className={
        size === 'lg'
          ? 'relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800 shadow-lg shadow-emerald-900/40'
          : 'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm'
      }
    >
      <span className={size === 'lg' ? 'text-base font-extrabold text-amber-300' : 'text-sm font-extrabold text-amber-300'}>
        TD
      </span>
      <span className="sheen-overlay rounded-2xl" />
    </div>
  );
}

export function LoginPage() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background font-sans">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 bg-[length:200%_200%] animate-gradient-x" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />

        {/* animated blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-amber-300/20 mix-blend-soft-light blur-3xl animate-blob" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-emerald-300/30 mix-blend-soft-light blur-3xl animate-blob animation-delay-2000" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-teal-300/30 mix-blend-soft-light blur-3xl animate-blob animation-delay-4000" />

        <div className="relative z-10 flex items-center gap-2.5 animate-fade-in-up">
          <BrandMark />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight">
              Tijarat <span className="text-amber-300">Developers</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">CRM Suite</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md animate-fade-in-up [animation-delay:150ms]">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Every lead captured.
            <br />
            Every deal followed.
            <br />
            <span className="text-amber-300">Zero business lost.</span>
          </h1>
          <p className="mt-4 text-sm text-white/80">
            Leads from Meta Ads, WhatsApp and your campaigns are distributed to your teams automatically — fairly,
            instantly, and tracked all the way to the close.
          </p>

          <div className="mt-10 space-y-4">
            {HIGHLIGHTS.map((h, i) => (
              <div
                key={h.label}
                className="flex items-start gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm animate-fade-in-up"
                style={{ animationDelay: `${250 + i * 120}ms` }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <h.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{h.label}</p>
                  <p className="text-xs text-white/70">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/60 animate-fade-in-up [animation-delay:600ms]">
          © {new Date().getFullYear()} Tijarat Developers CRM. Built for businesses that never miss a lead.
        </p>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] lg:hidden" />
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl lg:hidden" />

        <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-4 lg:hidden">
              <BrandMark size="lg" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome to <span className="text-gradient-brand">Tijarat Developers CRM</span>
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with the account your administrator created for you.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@company.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="relative w-full overflow-hidden bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 bg-[length:200%_200%] text-white shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-600/40 hover:brightness-110 animate-gradient-x"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:text-left">
            Protected workspace — access is granted only by your organization's administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
