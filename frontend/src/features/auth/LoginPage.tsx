import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Shuffle, Megaphone } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BG_COLOR = 0x1a1409;

const HIGHLIGHTS = [
  { icon: Shuffle, label: 'Automatic lead distribution', desc: 'Round-robin engine shares every lead fairly across teams' },
  { icon: Megaphone, label: 'Meta Ads & WhatsApp ready', desc: 'Leads flow straight from your campaigns into the pipeline' },
  { icon: ShieldCheck, label: 'Role-based security', desc: 'Admin, team lead and staff — each sees exactly their work' },
];

/** A small skyline of gold towers rendered in real 3D space (perspective + translateZ),
 * echoing the buildings in the brand mark. Tilts toward the cursor and idles with a gentle bob. */
const BUILDINGS = [
  { id: 1, left: 0, width: 30, height: 100, z: -50, delay: 0 },
  { id: 2, left: 34, width: 42, height: 170, z: 0, delay: 300 },
  { id: 3, left: 82, width: 26, height: 80, z: -30, delay: 600 },
  { id: 4, left: 114, width: 48, height: 210, z: 50, delay: 150 },
  { id: 5, left: 168, width: 32, height: 130, z: 10, delay: 450 },
  { id: 6, left: 206, width: 38, height: 180, z: 70, delay: 750 },
];

function GoldSkyline({ tilt }: { tilt: { rx: number; ry: number } }) {
  return (
    <div
      className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 sm:w-72"
      style={{ perspective: '1400px' }}
      aria-hidden="true"
    >
      <div className="absolute -bottom-4 left-1/2 h-6 w-48 -translate-x-1/2 rounded-full bg-amber-400/25 blur-2xl" />
      <div
        className="relative h-full w-full motion-reduce:!transform-none"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 0.2s ease-out',
        }}
      >
        {BUILDINGS.map((b) => (
          <div
            key={b.id}
            className="absolute bottom-0"
            style={{ left: b.left, width: b.width, height: b.height, transform: `translateZ(${b.z}px)` }}
          >
            <div
              className="motion-safe:animate-building-float h-full w-full rounded-t-sm bg-gradient-to-t from-amber-800 via-amber-500 to-amber-200 shadow-[0_0_30px_rgba(245,196,69,0.3)]"
              style={{ animationDelay: `${b.delay}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Looping video behind the sign-in card, with a dark overlay so the form
 * and heading stay legible over busy footage. Skips playback for users who
 * prefer reduced motion, falling back to the poster frame. */
function LoginBackgroundVideo() {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) videoRef.current?.pause();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src="/videos/login-bg.mp4"
        poster="/videos/login-bg-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/55" />
    </div>
  );
}

function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail('');
      setSent(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            Enter your account email and we'll send you a link to set a new password.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is
            on its way — check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div
      className={
        size === 'lg'
          ? 'relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-black/40'
          : 'relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm'
      }
    >
      <img src="/logo-mark.png" alt="Tijarat Developers" className="h-full w-full object-cover" />
      <span className="sheen-overlay rounded-2xl" />
    </div>
  );
}

export function LoginPage() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = React.useState(
    () => new URLSearchParams(window.location.search).get('email') ?? '',
  );
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0 });
  const [forgotOpen, setForgotOpen] = React.useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  function handlePanelMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: py * -14, ry: px * 14 });
  }

  function handlePanelMouseLeave() {
    setTilt({ rx: 0, ry: 0 });
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
    <div
      className="relative flex min-h-screen w-full overflow-hidden font-sans"
      style={{ background: `#${BG_COLOR.toString(16)}` }}
    >
      {/* Video now spans the whole page — both panels sit on top of it. */}
      <LoginBackgroundVideo />

      {/* Left brand panel */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        onMouseMove={handlePanelMouseMove}
        onMouseLeave={handlePanelMouseLeave}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/70 via-stone-900/55 to-amber-950/50 bg-[length:200%_200%] animate-gradient-x" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />

        {/* animated blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-amber-300/20 mix-blend-soft-light blur-3xl animate-blob" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-amber-500/20 mix-blend-soft-light blur-3xl animate-blob animation-delay-2000" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-yellow-600/20 mix-blend-soft-light blur-3xl animate-blob animation-delay-4000" />

        {/* interactive 3D gold skyline — tilts toward the cursor */}
        <GoldSkyline tilt={tilt} />

        <div className="relative z-10 flex items-center gap-3.5 animate-fade-in-up">
          <BrandMark />
          <div className="flex flex-col leading-tight">
            <span className="text-2xl font-extrabold tracking-tight">
              Tijarat <span className="text-amber-300">Developers</span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100/60">CRM Suite</span>
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
      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-6 py-12 lg:w-1/2">
        <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center animate-fade-in-up">
          <div className="mb-4 lg:hidden">
            <BrandMark size="lg" />
          </div>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
            <span className="text-white">Welcome to </span>
            <span className="text-amber-300">Tijarat Developers CRM</span>
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Sign in with the account your administrator created for you.
          </p>

          <div
            className="mt-8 w-full rounded-[18px] p-6 text-left backdrop-blur-md sm:p-8"
            style={{
              background: 'rgba(38, 28, 15, 0.55)',
              boxShadow: '0 0 0 1px rgba(240,165,0,0.3), 0 0 45px rgba(240,165,0,0.12), 0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-200">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8064]" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@company.com"
                    className="border-transparent bg-[#eef1ff] pl-9 text-[#1a1409] placeholder:text-[#8a8064] focus-visible:border-[#f0a500] focus-visible:ring-2 focus-visible:ring-[#f0a500]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-200">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8064]" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="border-transparent bg-[#eef1ff] pl-9 pr-9 text-[#1a1409] placeholder:text-[#8a8064] focus-visible:border-[#f0a500] focus-visible:ring-2 focus-visible:ring-[#f0a500]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8064] hover:text-[#1a1409]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-medium text-amber-300 hover:text-amber-200 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full text-black shadow-lg transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #f0a500, #ffcf5c)',
                  boxShadow: '0 10px 30px rgba(240,165,0,0.35)',
                }}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Protected workspace — access is granted only by your organization's administrator.
          </p>
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}
