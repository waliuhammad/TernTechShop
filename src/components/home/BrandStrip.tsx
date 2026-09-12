import { brandStrip } from '@/config/site';

export function BrandStrip() {
  return (
    <section className="mb-20 border-y border-slate-100 bg-slate-50/50 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 transition-all duration-700 hover:opacity-100 sm:gap-12 md:gap-24">
          {brandStrip.map((brand) => (
            <h3
              key={brand}
              className="text-xl font-black tracking-tighter text-slate-900 italic sm:text-2xl md:text-3xl"
            >
              {brand}
            </h3>
          ))}
        </div>
      </div>
    </section>
  );
}
