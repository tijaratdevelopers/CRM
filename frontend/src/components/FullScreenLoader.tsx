/** The single loading screen used everywhere in the app (auth check, dashboard, etc.) — keeps every loading moment visually identical instead of different one-off spinners. */
export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
      <div className="loader-3d-scene">
        <div className="loader-3d-cube">
          <div className="loader-3d-face" />
          <div className="loader-3d-face" />
          <div className="loader-3d-face" />
          <div className="loader-3d-face" />
          <div className="loader-3d-face" />
          <div className="loader-3d-face" />
        </div>
      </div>
      {label}
    </div>
  );
}
