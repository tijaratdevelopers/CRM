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

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: (i * 53.7) % 100,
  top: (i * 31.3) % 62,
  size: i % 4 === 0 ? 2.5 : 1.5,
  delay: (i * 137) % 4000,
  duration: 2400 + ((i * 97) % 2600),
}));

const SHOOTING_STARS = [
  { id: 1, top: '10%', left: '8%', delay: 500, duration: 4500 },
  { id: 2, top: '24%', left: '52%', delay: 2600, duration: 5200 },
];

const MOBILE_BUILDINGS = [
  { id: 1, left: 2, width: 22, height: 60, z: -40, delay: 0 },
  { id: 2, left: 9, width: 30, height: 105, z: 0, delay: 300 },
  { id: 3, left: 19, width: 18, height: 50, z: -20, delay: 600 },
  { id: 4, left: 26, width: 34, height: 135, z: 30, delay: 150 },
  { id: 5, left: 39, width: 24, height: 78, z: 10, delay: 450 },
  { id: 6, left: 49, width: 28, height: 115, z: 50, delay: 750 },
  { id: 7, left: 61, width: 20, height: 65, z: -10, delay: 250 },
  { id: 8, left: 70, width: 32, height: 125, z: 40, delay: 550 },
  { id: 9, left: 83, width: 22, height: 75, z: 0, delay: 850 },
  { id: 10, left: 91, width: 18, height: 52, z: -30, delay: 100 },
];

/** A slow-drifting ribbon of gold light, like an aurora — the signature glow effect
 * behind the sign-in card, echoing flowing light-wave backgrounds. Layered blurred
 * gradient streaks, each tilted and offset, animated together as one group. */
function AuroraRibbon({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute motion-safe:animate-ribbon-drift motion-reduce:!transform-none ${className ?? ''}`}
      aria-hidden="true"
    >
      <div className="absolute left-[-15%] top-[20%] h-16 w-[130%] -rotate-6 rounded-full bg-gradient-to-r from-transparent via-orange-500/35 to-transparent blur-3xl" />
      <div className="absolute left-[-15%] top-[48%] h-12 w-[130%] rotate-3 rounded-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent blur-2xl" />
      <div className="absolute left-[-15%] top-[70%] h-8 w-[130%] -rotate-2 rounded-full bg-gradient-to-r from-transparent via-amber-200/40 to-transparent blur-xl" />
    </div>
  );
}

/** Night skyline scene shown behind the sign-in card on small screens, where the
 * desktop brand panel is hidden — a starfield + glowing gold moon + 3D gold skyline. */
function MobileNightScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-stone-950 to-amber-950/50" />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />

      {/* glowing moon */}
      <div className="absolute -top-10 right-6 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="absolute top-8 right-12 h-14 w-14 rounded-full bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 shadow-[0_0_60px_18px_rgba(245,196,69,0.25)]" />

      {/* aurora ribbon */}
      <AuroraRibbon className="inset-x-0 top-[36%] h-40 w-full opacity-80" />

      {/* starfield */}
      {STARS.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-amber-100 motion-safe:animate-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}ms`,
            animationDuration: `${s.duration}ms`,
          }}
        />
      ))}

      {/* shooting stars */}
      {SHOOTING_STARS.map((s) => (
        <span
          key={s.id}
          className="absolute h-px w-24 -rotate-[28deg] bg-gradient-to-r from-transparent via-amber-200 to-transparent motion-safe:animate-shoot"
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}ms`, animationDuration: `${s.duration}ms` }}
        />
      ))}

      {/* 3D gold skyline */}
      <div className="absolute inset-x-0 bottom-0 h-52 sm:h-64" style={{ perspective: '1200px' }}>
        <div
          className="relative h-full w-full motion-safe:animate-sway-3d motion-reduce:!transform-none"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {MOBILE_BUILDINGS.map((b) => (
            <div
              key={b.id}
              className="absolute bottom-0"
              style={{ left: `${b.left}%`, width: b.width, height: b.height, transform: `translateZ(${b.z}px)` }}
            >
              <div
                className="motion-safe:animate-building-float h-full w-full rounded-t-sm bg-gradient-to-t from-amber-900 via-amber-500 to-amber-200 shadow-[0_0_24px_rgba(245,196,69,0.25)]"
                style={{ animationDelay: `${b.delay}ms` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GLOW_SPARKLES = [
  { id: 1, left: '78%', top: '14%', size: 3, delay: 300 },
  { id: 2, left: '85%', top: '20%', size: 2, delay: 1200 },
  { id: 3, left: '15%', top: '72%', size: 2.5, delay: 2000 },
  { id: 4, left: '10%', top: '18%', size: 1.5, delay: 800 },
];

/** Subtle aurora glow behind the sign-in card on wide screens, where the form panel
 * otherwise sits on flat background — keeps the desktop view from feeling bare. */
function DesktopFormGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block" aria-hidden="true">
      <AuroraRibbon className="inset-x-0 top-1/3 h-64 w-full opacity-60" />
      {GLOW_SPARKLES.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-amber-200 motion-safe:animate-twinkle"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: `${s.delay}ms` }}
        />
      ))}
    </div>
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
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background font-sans">
      {/* Left brand panel */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        onMouseMove={handlePanelMouseMove}
        onMouseLeave={handlePanelMouseLeave}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-stone-900 to-amber-950 bg-[length:200%_200%] animate-gradient-x" />
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
      <div className="relative flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2">
        <MobileNightScene />
        <DesktopFormGlow />

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
                className="relative w-full overflow-hidden bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 bg-[length:200%_200%] text-black shadow-lg shadow-amber-600/25 transition-all hover:shadow-amber-600/40 hover:brightness-110 animate-gradient-x"
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
