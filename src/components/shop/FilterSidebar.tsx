import { RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { performanceTiers } from '@/config/site';
import { useCatalog } from '@/context/CatalogContext';
import { type CatalogFilters } from '@/lib/catalog';
import { formatPrice } from '@/lib/money';

interface FilterSidebarProps {
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onReset: () => void;
}

function GroupHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase">{title}</h3>
      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
    </div>
  );
}

/** Adds or removes a value from a multi-select filter array. */
function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function FilterSidebar({ filters, onChange, onReset }: FilterSidebarProps) {
  const { categories, countByCategory, countByTier, maxPrice: catalogMaxPrice } = useCatalog();

  return (
    <div className="space-y-10 lg:space-y-12">
      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search catalog..."
          aria-label="Search the registry"
          className="w-full rounded-xl border border-slate-200 bg-white py-4 pr-4 pl-12 text-sm font-medium shadow-sm transition-all outline-none focus:border-primary"
        />
      </div>

      {/* Categories */}
      <div className="space-y-4">
        <GroupHeading title="Categories" />
        <div className="space-y-1">
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              aria-pressed={filters.categories.includes(category.name)}
              onClick={() => onChange({ categories: toggleValue(filters.categories, category.name) })}
              className="sidebar-link"
            >
              <span>{category.name}</span>
              <span className="font-mono text-[10px] text-slate-400">
                {countByCategory(category.name)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tiers */}
      <div className="space-y-4">
        <GroupHeading title="Performance Tiers" />
        <div className="space-y-1">
          {performanceTiers.map((tier) => (
            <button
              key={tier.key}
              type="button"
              aria-pressed={filters.tiers.includes(tier.label)}
              onClick={() => onChange({ tiers: toggleValue(filters.tiers, tier.label) })}
              className="sidebar-link"
            >
              <span>{tier.label}</span>
              <span className="font-mono text-[10px] text-slate-400">
                {countByTier(tier.label)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="space-y-4">
        <GroupHeading title="Valuation Ceiling" />
        <input
          type="range"
          min={0}
          max={catalogMaxPrice}
          step={100000}
          value={filters.maxPrice ?? catalogMaxPrice}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange({ maxPrice: next >= catalogMaxPrice ? null : next });
          }}
          aria-label="Maximum price"
          className="w-full cursor-pointer accent-primary"
        />
        <div className="flex justify-between font-mono text-[10px] font-bold text-slate-400 uppercase">
          <span>Rs. 0</span>
          <span className="text-primary">
            {formatPrice(filters.maxPrice ?? catalogMaxPrice)}
          </span>
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-4">
        <GroupHeading title="Availability" />
        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(event) => onChange({ inStockOnly: event.target.checked })}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          In Stock only
        </label>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 py-4 text-xs font-black text-slate-400 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white"
      >
        <RotateCcw size={14} />
        Reset Registry Parameters
      </button>

      {/* Consultation card */}
      <div className="relative space-y-6 overflow-hidden rounded-3xl bg-slate-900 p-8 text-white shadow-2xl">
        <h4 className="border-l-4 border-primary pl-4 text-xl font-black tracking-tighter uppercase italic">
          Custom Configuration?
        </h4>
        <p className="text-xs leading-relaxed font-medium text-slate-400">
          Our system architects can engineer a specific manifest tailored to your enterprise
          requirements.
        </p>
        <Link
          to="/contact"
          className="inline-block text-xs font-black tracking-[0.2em] text-primary uppercase transition-all hover:tracking-[0.3em]"
        >
          Consult Engineer
        </Link>
      </div>
    </div>
  );
}
