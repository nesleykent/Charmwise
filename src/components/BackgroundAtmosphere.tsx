export function BackgroundAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[linear-gradient(135deg,#050615_0%,#06091d_34%,#08051b_70%,#03040d_100%)]"
    >
      <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,#fdf497_0%,#fd5949_42%,transparent_70%)] opacity-30 blur-[78px]" />
      <div className="absolute left-24 top-1/3 h-[26rem] w-[22rem] rounded-full bg-[radial-gradient(circle,#fa709a_0%,#d6249f_48%,transparent_72%)] opacity-24 blur-[76px]" />
      <div className="absolute -right-24 top-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,#764ba2_0%,#285AEB_58%,transparent_74%)] opacity-30 blur-[86px]" />
      <div className="absolute bottom-[-16rem] right-12 h-[34rem] w-[38rem] rounded-full bg-[radial-gradient(circle,#667eea_0%,#285AEB_38%,transparent_72%)] opacity-24 blur-[96px]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.12)_0%,transparent_22%,rgba(255,255,255,0.055)_48%,transparent_74%)] opacity-45 blur-[1px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
    </div>
  );
}
