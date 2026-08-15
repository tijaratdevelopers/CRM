import * as React from 'react';
import * as THREE from 'three';

const GOLD = 0xf0a500;

/** A light echo of the login page's 3D scene — a couple of slow-drifting
 * wireframe shapes and a sparse field of particles, confined to the hero
 * banner instead of a full page so it stays a subtle touch, not a spectacle. */
export function DashboardHeroScene() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.z = 26;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const particleCount = 350;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: GOLD,
      size: 0.14,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const shapes = [
      { geometry: new THREE.IcosahedronGeometry(3.4, 0), x: 9, y: 1.5 },
      { geometry: new THREE.TorusGeometry(2.6, 0.7, 8, 28), x: -8, y: -2 },
    ].map(({ geometry, x, y }) => {
      const material = new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.22 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, 0);
      scene.add(mesh);
      return {
        mesh,
        rotSpeedX: 0.0015 + Math.random() * 0.003,
        rotSpeedY: 0.0015 + Math.random() * 0.003,
        bobSpeed: 0.3 + Math.random() * 0.3,
        bobAmount: 0.8,
        baseY: y,
        phase: Math.random() * Math.PI * 2,
      };
    });

    function handleResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId: number;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      particles.rotation.y += 0.0004;

      for (const s of shapes) {
        s.mesh.rotation.x += s.rotSpeedX;
        s.mesh.rotation.y += s.rotSpeedY;
        s.mesh.position.y = s.baseY + Math.sin(elapsed * s.bobSpeed + s.phase) * s.bobAmount;
      }

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      particleGeometry.dispose();
      particleMaterial.dispose();
      for (const s of shapes) {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}
