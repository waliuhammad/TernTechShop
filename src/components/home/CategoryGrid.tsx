import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { useCatalog } from '@/context/CatalogContext';
import { resolveIcon } from '@/lib/icons';

export function CategoryGrid() {
  const { categories, countByCategory } = useCatalog();

  return (
    <section className="border-b border-slate-100 bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          label="Registry Structure"
          title="Shop by"
          accent="Category"
          description="Explore our curated departments of professional hardware and enterprise engineering solutions."
          descriptionItalic
        >
          <div className="hidden gap-4 md:flex">
            <div className="h-1 w-12 rounded-full bg-primary" />
            <div className="h-1 w-4 rounded-full bg-slate-200" />
            <div className="h-1 w-4 rounded-full bg-slate-200" />
          </div>
        </SectionHeading>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {categories.map((category) => {
            const Icon = resolveIcon(category.iconKey);
            const count = countByCategory(category.name);

            return (
              <Link
                key={category.name}
                to={`/shop?category=${encodeURIComponent(category.name)}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 transition-all hover:border-primary/20 hover:shadow-2xl hover:shadow-slate-200/50 lg:p-10"
              >
                <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-slate-50 transition-colors group-hover:bg-primary/5" />

                <div className="relative z-10 mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-2xl transition-all duration-500 group-hover:bg-primary lg:h-20 lg:w-20">
                  <Icon size={32} />
                </div>

                <div className="relative z-10 space-y-3">
                  <h3 className="text-xl font-black tracking-tight text-slate-900 uppercase italic">
                    {category.name}
                  </h3>
                  <p className="text-sm leading-relaxed font-medium text-slate-500">
                    {category.description}
                  </p>
                  <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    {count} {count === 1 ? 'Unit' : 'Units'} Indexed
                  </p>
                </div>

                <div className="relative z-10 flex items-center gap-3 pt-6 text-[10px] font-black tracking-widest text-slate-400 uppercase transition-all group-hover:gap-5 group-hover:text-primary">
                  Browse Department
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
