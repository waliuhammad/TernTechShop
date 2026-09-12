import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { performanceTiers } from '@/config/site';
import { useCatalog } from '@/context/CatalogContext';
import { resolveIcon } from '@/lib/icons';

export function TierGrid() {
  const { countByTier } = useCatalog();

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          label="Performance Tiers"
          title="Shop by"
          accent="Infrastructure Tier"
          description="Segmented hardware catalogs based on performance requirements and deployment scale."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {performanceTiers.map((tier) => {
            const Icon = resolveIcon(tier.iconKey);
            const count = countByTier(tier.label);

            return (
              <Link
                key={tier.key}
                to={`/shop?tier=${encodeURIComponent(tier.label)}`}
                className="group flex flex-col rounded-[2rem] border border-slate-100 bg-white p-4 pb-8 transition-all hover:border-primary/20 hover:shadow-2xl lg:pb-10"
              >
                <div className="relative mb-6 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-50 transition-colors group-hover:bg-slate-900 lg:mb-8">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110 ${tier.colorClass}`}
                  >
                    <Icon size={28} />
                  </div>
                </div>

                <div className="space-y-3 px-4">
                  <h3 className="text-xl font-black tracking-tighter text-slate-900 uppercase italic">
                    {tier.label}
                  </h3>
                  <p className="text-sm leading-relaxed font-medium text-slate-500">
                    {tier.description}
                  </p>
                  <div className="flex items-center gap-2 pt-2 font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase transition-all group-hover:gap-4 group-hover:text-primary">
                    {count} {count === 1 ? 'Unit' : 'Units'}
                    <ArrowRight size={12} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
