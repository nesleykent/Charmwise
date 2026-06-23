// Quiet page depth only. The product surface carries the hierarchy, so the
// background stays close to native dark-mode graphite.
export function BackgroundAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_30%_-10%,rgba(10,132,255,0.16),transparent_32rem),linear-gradient(180deg,#0b0d11_0%,#080a0d_42%,#06070a_100%)]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
    </div>
  );
}
