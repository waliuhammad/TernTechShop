import { enterpriseFeatures } from '@/config/site';
import { resolveIcon } from '@/lib/icons';

const PANEL_IMAGE =
  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=900';

export function EnterpriseExecution() {
  return (
    // overflow-hidden keeps the decorative bloom circles from widening the page.
    <section className="overflow-hidden bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="space-y-8 md:space-y-10">
            <div className="inline-block rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold tracking-widest text-primary uppercase">
              Infrastructure Architecture
            </div>

            <h2 className="text-[clamp(2.25rem,9vw,4.5rem)] leading-[0.9] font-black tracking-tighter text-slate-900 uppercase italic md:text-7xl">
              Built for <br />
              <span className="text-primary not-italic">Enterprise</span> <br />
              Execution
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
              {enterpriseFeatures.map((feature) => {
                const Icon = resolveIcon(feature.iconKey);
                return (
                  <div
                    key={feature.title}
                    className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-primary/20 hover:shadow-xl"
                  >
                    <Icon size={28} className="text-primary" />
                    <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase italic">
                      {feature.title}
                    </h3>
                    <p className="text-xs leading-relaxed font-medium text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="relative z-10 aspect-[4/5] max-h-[600px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl md:rounded-[3rem]">
              <img
                src={PANEL_IMAGE}
                alt="Data centre rack infrastructure"
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-[1.5rem] object-cover md:rounded-[2.5rem]"
              />
            </div>
            <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
            <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
