/** The dashboard mascot — a fixed-pose render (only a front view exists, so
 * this can't do a true 360° turn), given a gentle float/sway plus a pulsing
 * glow behind it so it still reads as "alive" rather than a static image. */
export function DashboardRobotMascot() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="pointer-events-none absolute h-40 w-40 animate-pulse rounded-full bg-cyan-400/25 blur-3xl" />
      <img
        src="/images/robot-mascot.webp"
        alt="CRM assistant robot"
        className="relative h-full w-auto max-w-full animate-sway object-contain drop-shadow-[0_0_25px_rgba(53,208,255,0.35)]"
      />
    </div>
  );
}
