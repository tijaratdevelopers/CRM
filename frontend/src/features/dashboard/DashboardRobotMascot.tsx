import * as React from 'react';
import * as THREE from 'three';

const METAL = 0xe4e8ee;
const DARK = 0x2b2f38;
const GLOW = 0x27c3ff;

/** Full rotation period, in seconds — kept inside the 8-12s "smooth, not
 * distracting" range from the design brief. */
const ROTATION_PERIOD = 10;

/** A small procedural robot mascot that spins continuously on its Y-axis for
 * as long as the dashboard hero housing it stays mounted. Built from plain
 * three.js primitives (matching DashboardHeroScene's approach) rather than a
 * loaded .glb — swap in a real model here later without touching the hero. */
export function DashboardRobotMascot() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.5, 7);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(2, 4, 5);
    scene.add(keyLight);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: METAL, metalness: 0.35, roughness: 0.4 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: DARK, metalness: 0.4, roughness: 0.5 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: GLOW });

    const robot = new THREE.Group();

    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), bodyMaterial);
    head.scale.set(1, 0.92, 0.95);
    head.position.y = 2.5;
    robot.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 0.3), darkMaterial);
    visor.position.set(0, 2.52, 0.82);
    robot.add(visor);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), glowMaterial);
      eye.position.set(side * 0.34, 2.52, 1.0);
      robot.add(eye);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 16), darkMaterial);
    neck.position.y = 1.75;
    robot.add(neck);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1), bodyMaterial);
    torso.position.y = 1.0;
    robot.add(torso);

    const emblem = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 4), glowMaterial);
    emblem.position.set(0, 1.25, 0.55);
    emblem.rotation.x = Math.PI;
    robot.add(emblem);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 1.4, 12), bodyMaterial);
      arm.position.set(side * 1.05, 1.0, 0);
      arm.rotation.z = side * 0.12;
      robot.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), darkMaterial);
      hand.position.set(side * 1.2, 0.28, 0);
      robot.add(hand);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.3, 12), darkMaterial);
      leg.position.set(side * 0.42, -0.65, 0);
      robot.add(leg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.7), darkMaterial);
      foot.position.set(side * 0.42, -1.4, 0.12);
      robot.add(foot);
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 8, 48), glowMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.55;
    robot.add(ring);

    scene.add(robot);

    function handleResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    const angularSpeed = (Math.PI * 2) / ROTATION_PERIOD;
    let frameId: number;

    function animate() {
      frameId = requestAnimationFrame(animate);
      robot.rotation.y += angularSpeed * clock.getDelta();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      robot.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      bodyMaterial.dispose();
      darkMaterial.dispose();
      glowMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
