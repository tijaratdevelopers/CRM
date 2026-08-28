import * as React from 'react';
import * as THREE from 'three';

const BLUE = 0x38bdf8;
const DEEP = 0x0ea5e9;
const WHITE = 0xf1f5f9;

/**
 * A stylised humanoid robot built from three.js primitives — the dashboard's
 * centrepiece. Neon-blue emissive accents, a rotating holographic base ring and
 * a slow idle + wave. Falls back to a static pose when reduced motion is set.
 */
export function DashboardRobot() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const width = () => mount.clientWidth || 400;
    const height = () => mount.clientHeight || 380;
    const camera = new THREE.PerspectiveCamera(42, width() / height(), 0.1, 100);
    camera.position.set(0, 1.2, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.PointLight(BLUE, 60, 40);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x8b5cf6, 40, 40);
    rim.position.set(-5, 2, -4);
    scene.add(rim);

    const bodyMat = new THREE.MeshStandardMaterial({ color: WHITE, metalness: 0.6, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: BLUE,
      emissive: DEEP,
      emissiveIntensity: 1.6,
      metalness: 0.4,
      roughness: 0.2,
    });

    const robot = new THREE.Group();

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 1.35), bodyMat);
    head.position.y = 2.35;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.1), darkMat);
    visor.position.set(0, 2.4, 0.7);
    const eyeGeo = new THREE.BoxGeometry(0.32, 0.28, 0.12);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat);
    eyeL.position.set(-0.32, 2.4, 0.75);
    const eyeR = new THREE.Mesh(eyeGeo, glowMat);
    eyeR.position.set(0.32, 2.4, 0.75);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), darkMat);
    antenna.position.set(0, 3.1, 0);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.1), glowMat);
    antennaTip.position.set(0, 3.38, 0);
    robot.add(head, visor, eyeL, eyeR, antenna, antennaTip);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2, 1.15), bodyMat);
    torso.position.y = 0.85;
    const chest = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), glowMat);
    chest.position.set(0, 1.05, 0.6);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.35), darkMat);
    collar.position.y = 1.95;
    robot.add(torso, chest, collar);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.62, 1.7, 0.7);
    const legL = new THREE.Mesh(legGeo, darkMat);
    legL.position.set(-0.5, -0.9, 0);
    const legR = new THREE.Mesh(legGeo, darkMat);
    legR.position.set(0.5, -0.9, 0);
    const footGeo = new THREE.BoxGeometry(0.75, 0.3, 1);
    const footL = new THREE.Mesh(footGeo, bodyMat);
    footL.position.set(-0.5, -1.85, 0.15);
    const footR = new THREE.Mesh(footGeo, bodyMat);
    footR.position.set(0.5, -1.85, 0.15);
    robot.add(legL, legR, footL, footR);

    // Left arm (still)
    const armGeo = new THREE.BoxGeometry(0.42, 1.7, 0.42);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-1.35, 0.85, 0);
    robot.add(armL);

    // Right arm (waves) — pivot at the shoulder
    const rightArm = new THREE.Group();
    rightArm.position.set(1.2, 1.65, 0);
    const upperArm = new THREE.Mesh(armGeo, bodyMat);
    upperArm.position.y = -0.85;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowMat);
    hand.position.y = -1.75;
    rightArm.add(upperArm, hand);
    rightArm.rotation.z = -0.5;
    robot.add(rightArm);

    robot.position.y = 0.3;
    scene.add(robot);

    // Holographic base rings
    const ringMat = new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.5 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 8, 64), ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = -2.1;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.03, 8, 64), ringMat.clone());
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -2.1;
    (ring2.material as THREE.MeshBasicMaterial).opacity = 0.25;
    scene.add(ring1, ring2);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshBasicMaterial({ color: DEEP, transparent: true, opacity: 0.08 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -2.08;
    scene.add(disc);

    // Particles
    const pCount = 120;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 12;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: BLUE, size: 0.05, transparent: true, opacity: 0.7 }),
    );
    scene.add(particles);

    function handleResize() {
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
      renderer.setSize(width(), height());
      if (reduceMotion) renderStatic();
    }
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let frameId = 0;

    function renderStatic() {
      rightArm.rotation.z = -1.9;
      renderer.render(scene, camera);
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      robot.position.y = 0.3 + Math.sin(t * 1.1) * 0.12;
      robot.rotation.y = Math.sin(t * 0.4) * 0.18;
      rightArm.rotation.z = -1.7 + Math.sin(t * 3) * 0.35;
      ring1.rotation.z = t * 0.6;
      ring2.rotation.z = -t * 0.4;
      particles.rotation.y = t * 0.05;
      const pulse = 1.3 + Math.sin(t * 2.5) * 0.5;
      glowMat.emissiveIntensity = pulse;
      renderer.render(scene, camera);
    }

    if (reduceMotion) renderStatic();
    else animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative flex w-full items-center justify-center">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-sky-500/10 blur-3xl" />
      <div ref={mountRef} className="h-[380px] w-full min-w-0" aria-hidden="true" />
    </div>
  );
}
