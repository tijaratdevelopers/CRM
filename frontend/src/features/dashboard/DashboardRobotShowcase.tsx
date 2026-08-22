import { DashboardRobotMascot } from './DashboardRobotMascot';

/** A prominent, dedicated stage for the spinning robot mascot — sized so the
 * full figure and its 360° turn are clearly visible, instead of being
 * squeezed into a small corner icon slot. */
export function DashboardRobotShowcase() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-900 via-neutral-950 to-black shadow-lg animate-fade-in-up">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative h-64 w-full sm:h-72">
        <DashboardRobotMascot />
      </div>
    </div>
  );
}
