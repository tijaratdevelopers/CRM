/** The dashboard mascot — a fixed-pose render (only a front view exists).
 * Spun continuously on its Y-axis in place via a real 3D CSS transform, per
 * spec — since there's no back-view art, the edge-on moment at 90°/270° will
 * show the image side-on/thin rather than a true back view; it never drifts
 * from its spot, only turns. */
export function DashboardRobotMascot() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{ perspective: '1200px' }}
    >
      <div className="pointer-events-none absolute h-40 w-40 animate-pulse rounded-full bg-cyan-400/25 blur-3xl" />
      <img
        src="/images/robot-mascot.webp"
        alt="CRM assistant robot"
        className="relative h-full w-auto max-w-full animate-spin-y object-contain drop-shadow-[0_0_25px_rgba(53,208,255,0.35)]"
        style={{ transformStyle: 'preserve-3d' }}
      />
    </div>
  );
}
