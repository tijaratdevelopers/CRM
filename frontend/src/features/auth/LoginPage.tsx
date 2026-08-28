import * as React from 'react';
import * as THREE from 'three';
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

const GOLD = 0xf0a500;
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

/** The 3D scene behind the sign-in card: an AI "neural network" rendered in real 3D —
 * ~140 gold neuron nodes distributed through a brain-shaped volume, wired to their nearest
 * neighbours with faint synapse lines, with bright signal pulses that travel edge to edge
 * and make nodes flare as they pass. A field of drifting dust sits behind it, the whole
 * lattice rotates slowly, and the camera eases toward the mouse for a subtle parallax feel. */
function ThreeLoginBackground() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.z = 46;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // ── ambient dust ────────────────────────────────────────────────
    const dustCount = 1400;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 110;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 110;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 110;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: GOLD,
      size: 0.14,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    // ── neural network ──────────────────────────────────────────────
    const net = new THREE.Group();
    scene.add(net);

    const NODE_COUNT = 140;
    const RADII = new THREE.Vector3(24, 16, 17); // brain-ish ellipsoid
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();
      dir.multiplyScalar(Math.cbrt(Math.random())); // fill the volume, not just the shell
      nodes.push(new THREE.Vector3(dir.x * RADII.x, dir.y * RADII.y, dir.z * RADII.z));
    }

    // node points — a base colour buffer we brighten transiently when a pulse passes
    const nodePositions = new Float32Array(NODE_COUNT * 3);
    const nodeColors = new Float32Array(NODE_COUNT * 3);
    const nodeGlow = new Float32Array(NODE_COUNT); // 0..1 transient flare
    const baseCol = new THREE.Color(GOLD);
    for (let i = 0; i < NODE_COUNT; i++) {
      nodePositions[i * 3] = nodes[i].x;
      nodePositions[i * 3 + 1] = nodes[i].y;
      nodePositions[i * 3 + 2] = nodes[i].z;
      nodeColors[i * 3] = baseCol.r;
      nodeColors[i * 3 + 1] = baseCol.g;
      nodeColors[i * 3 + 2] = baseCol.b;
    }
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
    const nodeMaterial = new THREE.PointsMaterial({
      size: 0.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
    });
    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    net.add(nodePoints);

    // edges — connect each node to its few nearest neighbours
    const edges: { a: number; b: number }[] = [];
    const seen = new Set<string>();
    const MAX_LINKS = 3;
    const MAX_DIST = 13;
    for (let i = 0; i < NODE_COUNT; i++) {
      const near = nodes
        .map((p, j) => ({ j, d: p.distanceTo(nodes[i]) }))
        .filter((o) => o.j !== i && o.d < MAX_DIST)
        .sort((x, y) => x.d - y.d)
        .slice(0, MAX_LINKS);
      for (const { j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ a: i, b: j });
      }
    }
    const edgePositions = new Float32Array(edges.length * 6);
    for (let e = 0; e < edges.length; e++) {
      const { a, b } = edges[e];
      edgePositions.set([nodes[a].x, nodes[a].y, nodes[a].z, nodes[b].x, nodes[b].y, nodes[b].z], e * 6);
    }
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.12,
    });
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    net.add(edgeLines);

    // signal pulses that travel along edges
    const PULSE_COUNT = Math.min(60, edges.length);
    const pulses = Array.from({ length: PULSE_COUNT }, () => ({
      edge: Math.floor(Math.random() * edges.length),
      t: Math.random(),
      speed: 0.15 + Math.random() * 0.5,
    }));
    const pulsePositions = new Float32Array(PULSE_COUNT * 3);
    const pulseGeometry = new THREE.BufferGeometry();
    pulseGeometry.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));
    const pulseMaterial = new THREE.PointsMaterial({
      color: 0xffe6ab,
      size: 1.15,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulsePoints = new THREE.Points(pulseGeometry, pulseMaterial);
    net.add(pulsePoints);

    let targetX = 0;
    let targetY = 0;
    function handleMouseMove(e: MouseEvent) {
      const rect = mount!.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    mount.addEventListener('mousemove', handleMouseMove);

    function handleResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    const flareCol = new THREE.Color(0xffe6ab);
    const tmpCol = new THREE.Color();
    let elapsed = 0;
    let frameId: number;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;

      if (!prefersReducedMotion) {
        dust.rotation.y += 0.0004;
        net.rotation.y += 0.0011;
        net.rotation.x = Math.sin(elapsed * 0.12) * 0.12;

        for (let i = 0; i < NODE_COUNT; i++) nodeGlow[i] *= 0.92;

        for (let p = 0; p < PULSE_COUNT; p++) {
          const pu = pulses[p];
          pu.t += pu.speed * dt;
          if (pu.t >= 1) {
            nodeGlow[edges[pu.edge].b] = 1; // node flares as the signal arrives
            pu.edge = Math.floor(Math.random() * edges.length);
            pu.t = 0;
            pu.speed = 0.15 + Math.random() * 0.5;
          }
          const { a, b } = edges[pu.edge];
          pulsePositions[p * 3] = nodes[a].x + (nodes[b].x - nodes[a].x) * pu.t;
          pulsePositions[p * 3 + 1] = nodes[a].y + (nodes[b].y - nodes[a].y) * pu.t;
          pulsePositions[p * 3 + 2] = nodes[a].z + (nodes[b].z - nodes[a].z) * pu.t;
        }
        pulseGeometry.attributes.position.needsUpdate = true;

        for (let i = 0; i < NODE_COUNT; i++) {
          const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.6 + i);
          tmpCol.copy(baseCol).lerp(flareCol, Math.min(1, nodeGlow[i] + pulse * 0.15));
          nodeColors[i * 3] = tmpCol.r;
          nodeColors[i * 3 + 1] = tmpCol.g;
          nodeColors[i * 3 + 2] = tmpCol.b;
        }
        nodeGeometry.attributes.color.needsUpdate = true;
        edgeMaterial.opacity = 0.1 + 0.05 * Math.sin(elapsed * 0.8);
      }

      camera.position.x += (targetX * 7 - camera.position.x) * 0.03;
      camera.position.y += (-targetY * 5 - camera.position.y) * 0.03;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('mousemove', handleMouseMove);
      dustGeometry.dispose();
      dustMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      pulseGeometry.dispose();
      pulseMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
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

      {/* Right form panel — 3D animated background per spec */}
      <div
        className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-6 py-12 lg:w-1/2"
        style={{ background: `#${BG_COLOR.toString(16)}` }}
      >
        <ThreeLoginBackground />

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
