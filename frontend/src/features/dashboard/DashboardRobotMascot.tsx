import * as React from 'react';
import * as THREE from 'three';

const METAL = 0xeef1f5;
const DARK = 0x2b2f38;
const GLOW = 0x35d0ff;

/** Full rotation period, in seconds — kept inside the 8-12s "smooth, not
 * distracting" range from the design brief. */
const ROTATION_PERIOD = 10;

/** A procedural robot mascot that spins continuously on its Y-axis for as
 * long as the showcase housing it stays mounted. Built from plain three.js
 * primitives (matching DashboardHeroScene's approach) rather than a loaded
 * .glb — swap in a real model here later without touching the showcase. */
export function DashboardRobotMascot() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.7, 8.5);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(2, 4, 5);
    scene.add(keyLight);
    const glowLight = new THREE.PointLight(GLOW, 6, 8);
    glowLight.position.set(0, -1.2, 1.5);
    scene.add(glowLight);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: METAL, metalness: 0.15, roughness: 0.3 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: DARK, metalness: 0.3, roughness: 0.5 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: GLOW });

    const robot = new THREE.Group();

    // Chibi proportions — a big rounded head over a shorter body, like the
    // reference mascot art, rather than a realistic humanoid.
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 32), bodyMaterial);
    head.scale.set(1, 0.94, 0.95);
    head.position.y = 2.55;
    robot.add(head);

    const visor = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 6, 12), darkMaterial);
    visor.rotation.z = Math.PI / 2;
    visor.scale.set(1, 1, 0.55);
    visor.position.set(0, 2.58, 0.98);
    robot.add(visor);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), glowMaterial);
      eye.position.set(side * 0.34, 2.58, 1.14);
      robot.add(eye);

      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16), glowMaterial);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(side * 1.18, 2.55, 0);
      robot.add(ear);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 16), darkMaterial);
    neck.position.y = 1.75;
    robot.add(neck);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 0.95, 8, 16), bodyMaterial);
    torso.position.y = 1.1;
    robot.add(torso);

    const emblem = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 3), glowMaterial);
    emblem.position.set(0, 1.3, 0.72);
    emblem.rotation.x = Math.PI / 2;
    robot.add(emblem);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), darkMaterial);
      shoulder.position.set(side * 1.05, 1.55, 0);
      robot.add(shoulder);

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 6, 12), bodyMaterial);
      arm.position.set(side * 1.15, 0.85, 0);
      arm.rotation.z = side * 0.1;
      robot.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), darkMaterial);
      hand.position.set(side * 1.22, 0.15, 0);
      robot.add(hand);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), darkMaterial);
      leg.position.set(side * 0.4, -0.55, 0);
      robot.add(leg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.75), darkMaterial);
      foot.position.set(side * 0.4, -1.15, 0.15);
      robot.add(foot);
    }

    scene.add(robot);

    // A glowing ring + soft halo disc under the robot's feet, echoing the
    // sci-fi platform in the reference art. Kept outside the rotating group
    // so the ring itself doesn't visibly spin — only the robot does.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.06, 8, 48), glowMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.5;
    scene.add(ring);

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: GLOW,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.75, 48), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -1.49;
    scene.add(halo);

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
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      bodyMaterial.dispose();
      darkMaterial.dispose();
      glowMaterial.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
