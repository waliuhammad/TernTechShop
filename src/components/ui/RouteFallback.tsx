/** Shown while a lazily-loaded route chunk is fetched. */
export function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
        Initializing components…
      </p>
    </div>
  );
}
