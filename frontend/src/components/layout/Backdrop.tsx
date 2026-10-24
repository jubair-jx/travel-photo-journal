// Decorative aurora behind every page: soft blurred colour fields and a faint grid, fixed so
// content scrolls over it.
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-orange-500/25 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 size-[32rem] rounded-full bg-fuchsia-600/20 blur-[130px]" />
      <div className="absolute -bottom-48 left-1/4 size-[36rem] rounded-full bg-sky-500/20 blur-[140px]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}
