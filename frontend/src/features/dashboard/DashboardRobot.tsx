import * as React from 'react';

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The dashboard centrepiece — an AI assistant clip that occupies the same slot
 * the 3D robot scene used to. Autoplays muted and loops; holds on the first
 * frame when the viewer prefers reduced motion.
 */
export function DashboardRobot() {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (el && !reduceMotion) {
      el.play().catch(() => {
        /* autoplay can still be blocked on some browsers — leave the frame shown */
      });
    }
  }, []);

  return (
    <div className="relative flex w-full items-center justify-center">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-sky-500/10 blur-3xl" />
      <video
        ref={videoRef}
        className="h-[400px] w-full min-w-0 rounded-2xl object-cover"
        src="/robot-hero.mp4"
        autoPlay={!reduceMotion}
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
    </div>
  );
}
