import * as React from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CYAN = 0x2dd4ff;
const BLUE = 0x0ea5e9;

/** Builds a small canvas texture that reads as a floating holographic data panel. */
function makeHoloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(10,30,45,0.35)';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(45,212,255,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(45,212,255,0.9)';
  const bars = [40, 90, 60, 120, 75, 150, 100];
  bars.forEach((h, i) => ctx.fillRect(20 + i * 30, 220 - h, 16, h));
  ctx.strokeStyle = 'rgba(125,235,255,0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, 60);
  [30, 20, 55, 35, 70, 45, 90].forEach((y, i) => ctx.lineTo(10 + i * 38, y));
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A polished sci-fi mascot bot — rounded capsule body, glossy env-mapped shell,
 * emissive cyan features amplified by a bloom pass, floating holographic panels
 * and a glowing base. Idle float + wave. Static single frame under reduced motion.
 */
export function DashboardRobot() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = () => mount.clientWidth || 420;
    const H = () => mount.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.1, 100);
    camera.position.set(0.2, 1.1, 8.4);
    camera.lookAt(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    scene.add(new THREE.HemisphereLight(0x8fc4e6, 0x0a0f1c, 0.28));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(5, 7, 4);
    scene.add(key);
    const rimL = new THREE.PointLight(CYAN, 9, 24);
    rimL.position.set(-5, 2, 2);
    scene.add(rimL);
    const rimR = new THREE.PointLight(0x7c5cff, 7, 24);
    rimR.position.set(5, 0, -3);
    scene.add(rimR);

    const shell = new THREE.MeshStandardMaterial({ color: 0x66748a, metalness: 0.45, roughness: 0.5, envMapIntensity: 0.35 });
    const shellDark = new THREE.MeshStandardMaterial({ color: 0x0d131e, metalness: 0.65, roughness: 0.28, envMapIntensity: 0.35 });
    const glow = new THREE.MeshStandardMaterial({
      color: CYAN,
      emissive: CYAN,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.25,
      envMapIntensity: 0.15,
    });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xbdf2ff, emissive: 0x67e8ff, emissiveIntensity: 2.6, roughness: 0.2 });

    const bot = new THREE.Group();
    bot.position.y = 0.15;
    bot.scale.setScalar(1.12);

    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 0.9, 12, 24), shell);
    torso.position.y = 0.9;
    torso.scale.z = 0.8;
    bot.add(torso);
    const belly = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 16, 40), glow);
    belly.position.set(0, 0.95, 0.62);
    bot.add(belly);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), glow);
    core.position.set(0, 0.95, 0.63);
    bot.add(core);

    // Head
    const head = new THREE.Group();
    head.position.y = 2.15;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.82, 40, 32), shell);
    skull.scale.set(1.15, 1, 1.05);
    head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.7, 40, 32, 0, Math.PI * 2, 0, Math.PI * 0.62), shellDark);
    face.rotation.x = Math.PI * 0.16;
    face.position.z = 0.34;
    face.scale.set(1.2, 1, 0.6);
    head.add(face);
    const eyeGeo = new THREE.CapsuleGeometry(0.12, 0.18, 8, 16);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.rotation.z = Math.PI / 2;
    eyeL.position.set(-0.28, 0.06, 0.76);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.28;
    head.add(eyeL, eyeR);
    const earGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.14, 24);
    const earL = new THREE.Mesh(earGeo, glow);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.95, 0, 0);
    const earR = earL.clone();
    earR.position.x = 0.95;
    head.add(earL, earR);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), shellDark);
    antenna.position.y = 0.95;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), glow);
    tip.position.y = 1.22;
    head.add(antenna, tip);
    bot.add(head);

    // Arms
    function makeArm(side: number) {
      const g = new THREE.Group();
      g.position.set(side * 1.05, 1.5, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 20), shell);
      const joint = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 24), glow);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.72, 8, 16), shell);
      upper.position.y = -0.55;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 20), shell);
      hand.position.y = -1.05;
      g.add(shoulder, joint, upper, hand);
      return g;
    }
    const armL = makeArm(-1);
    armL.rotation.z = 0.35;
    const armR = makeArm(1);
    armR.rotation.z = -1.9;
    bot.add(armL, armR);

    // Legs
    function makeLeg(side: number) {
      const g = new THREE.Group();
      g.position.set(side * 0.42, 0.25, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 8, 16), shellDark);
      leg.position.y = -0.3;
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 8, 16), shell);
      foot.rotation.z = Math.PI / 2;
      foot.position.set(0, -0.72, 0.14);
      g.add(leg, foot);
      return g;
    }
    bot.add(makeLeg(-1), makeLeg(1));

    scene.add(bot);

    // Base
    const base = new THREE.Group();
    base.position.y = -0.95;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 64),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.06 }),
    );
    disc.rotation.x = -Math.PI / 2;
    base.add(disc);
    const rings: THREE.Mesh[] = [];
    [1.7, 2.3, 2.9].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.02 + i * 0.006, 8, 96),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6 - i * 0.15 }),
      );
      ring.rotation.x = -Math.PI / 2;
      base.add(ring);
      rings.push(ring);
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pillar = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 1.6),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      pillar.position.set(Math.cos(a) * 1.9, 0.8, Math.sin(a) * 1.9);
      pillar.lookAt(0, 0.8, 0);
      base.add(pillar);
    }
    scene.add(base);

    // Holographic panels
    const holoTex = makeHoloTexture();
    const panels: THREE.Mesh[] = [];
    const panelMat = new THREE.MeshBasicMaterial({
      map: holoTex,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    [
      { p: new THREE.Vector3(-3, 1.9, -0.5), r: 0.4, s: 1.5 },
      { p: new THREE.Vector3(3.1, 2.5, -0.8), r: -0.5, s: 1.1 },
      { p: new THREE.Vector3(2.7, 0.4, 0.6), r: -0.3, s: 0.9 },
    ].forEach(({ p, r, s }) => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(s, s), panelMat);
      panel.position.copy(p);
      panel.rotation.y = r;
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(s * 1.06, s * 1.06),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.25, wireframe: true }),
      );
      panel.add(frame);
      scene.add(panel);
      panels.push(panel);
    });

    // Particles
    const pCount = 90;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 11;
      pPos[i * 3 + 1] = Math.random() * 6 - 1;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: CYAN, size: 0.045, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }),
    );
    scene.add(particles);

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.42, 0.35, 1.15);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setSize(W(), H());

    function resize() {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
      composer.setSize(W(), H());
      if (reduceMotion) composer.render();
    }
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();
      bot.position.y = 0.15 + Math.sin(t * 1.2) * 0.12;
      bot.rotation.y = Math.sin(t * 0.35) * 0.22;
      head.rotation.y = Math.sin(t * 0.7) * 0.12;
      armR.rotation.z = -1.75 + Math.sin(t * 3.2) * 0.32;
      glow.emissiveIntensity = 1.3 + Math.sin(t * 2.6) * 0.4;
      eyeMat.emissiveIntensity = 2.4 + Math.sin(t * 4) * 0.5;
      rings.forEach((r, i) => (r.rotation.z = t * (0.3 + i * 0.15) * (i % 2 ? -1 : 1)));
      panels.forEach((p, i) => {
        p.position.y += Math.sin(t * 1.3 + i) * 0.0016;
        p.rotation.z = Math.sin(t * 0.6 + i) * 0.05;
      });
      particles.rotation.y = t * 0.04;
      composer.render();
    }
    if (reduceMotion) {
      armR.rotation.z = -1.9;
      composer.render();
    } else frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      holoTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative flex w-full items-center justify-center">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-sky-500/10 blur-3xl" />
      <div ref={mountRef} className="h-[400px] w-full min-w-0" aria-hidden="true" />
    </div>
  );
}
