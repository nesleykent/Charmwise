// Pure decoration: four large, heavily blurred colour spots fixed behind the
// whole app, blended with `screen` so they read as soft light glowing through
// the dark surface rather than flat painted shapes. No state, no JS - this
// renders as static HTML so it costs nothing at runtime.
export function BackgroundAtmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-charm-accent/30 mix-blend-screen blur-[110px]" />
      <div className="absolute -right-24 top-1/4 h-[26rem] w-[26rem] rounded-full bg-charm-rose/25 mix-blend-screen blur-[100px]" />
      <div className="absolute -right-40 bottom-0 h-[38rem] w-[38rem] rounded-full bg-charm-major/25 mix-blend-screen blur-[120px]" />
      <div className="absolute -left-20 bottom-1/3 h-[22rem] w-[22rem] rounded-full bg-charm-primary/20 mix-blend-screen blur-[100px]" />
    </div>
  );
}
