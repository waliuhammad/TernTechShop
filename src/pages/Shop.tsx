import { AnimatePresence, motion } from 'framer-motion';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '@/components/product/ProductCard';
import { FilterSidebar } from '@/components/shop/FilterSidebar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Seo } from '@/components/ui/Seo';
import { PRODUCTS_PER_PAGE, sortOptions, type SortOption } from '@/config/site';
import { useCatalog } from '@/context/CatalogContext';
import { filterProducts, paginate, type CatalogFilters } from '@/lib/catalog';

const SHOP_BACKDROP =
  'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&q=80&w=1600';

const VALID_SORTS = sortOptions.map((option) => option.value);

/** Reads filter state out of the URL so the view is shareable and bookmarkable. */
function readFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get('sort');
  const maxPrice = params.get('maxPrice');

  return {
    search: params.get('search') ?? '',
    categories: params.getAll('category'),
    tiers: params.getAll('tier'),
    inStockOnly: params.get('inStock') === '1',
    maxPrice: maxPrice ? Number(maxPrice) : null,
    sort: (VALID_SORTS as string[]).includes(sort ?? '') ? (sort as SortOption) : 'featured',
  };
}

export default function Shop() {
  const { products, loading } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = Number(searchParams.get('page') ?? '1');

  const results = useMemo(() => filterProducts(products, filters), [products, filters]);
  const pageData = useMemo(
    () => paginate(results, page, PRODUCTS_PER_PAGE),
    [results, page],
  );

  // Keep the URL honest if the page number outran the result set.
  useEffect(() => {
    if (pageData.page !== page) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(pageData.page));
      setSearchParams(next, { replace: true });
    }
  }, [pageData.page, page, searchParams, setSearchParams]);

  useEffect(() => {
    document.body.style.overflow = mobileFiltersOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileFiltersOpen]);

  const applyFilters = useCallback(
    (patch: Partial<CatalogFilters>) => {
      const next = { ...filters, ...patch };
      const params = new URLSearchParams();

      if (next.search) params.set('search', next.search);
      next.categories.forEach((category) => params.append('category', category));
      next.tiers.forEach((tier) => params.append('tier', tier));
      if (next.inStockOnly) params.set('inStock', '1');
      if (next.maxPrice !== null) params.set('maxPrice', String(next.maxPrice));
      if (next.sort !== 'featured') params.set('sort', next.sort);
      // Any filter change resets to the first page.
      params.set('page', '1');

      setSearchParams(params);
    },
    [filters, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const changePage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(nextPage));
      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams],
  );

  const activeFilterCount =
    filters.categories.length +
    filters.tiers.length +
    (filters.inStockOnly ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-32">
      <Seo
        title="Hardware Manifest"
        description="Browse the full registry of industrial-grade components, processors, graphics cards and enterprise networking hardware."
      />

      {/* Page header */}
      <div className="relative mt-12 overflow-hidden border-b border-slate-100 bg-white py-16 text-slate-900 md:mt-20 md:py-24">
        <div className="absolute inset-0 opacity-5">
          <img src={SHOP_BACKDROP} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-[clamp(2.25rem,10vw,4rem)] font-black tracking-tighter uppercase italic md:text-6xl">
            Hardware Manifest
          </h1>
          <p className="mt-4 max-w-xl font-mono text-xs leading-relaxed tracking-[0.2em] text-slate-500 uppercase sm:text-sm sm:tracking-[0.3em]">
            // SYSTEM_REGISTRY_ACCESS: GRANTED
            <br />
            Authorized access to industrial grade components and enterprise solutions.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-16 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          {/* Desktop sidebar */}
          <aside className="hidden w-full flex-shrink-0 lg:block lg:w-80">
            <FilterSidebar filters={filters} onChange={applyFilters} onReset={resetFilters} />
          </aside>

          <main className="min-w-0 flex-grow">
            {/* Results header */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-6 md:mb-12">
              <div className="space-y-2">
                <p className="text-[10px] font-bold tracking-[0.3em] text-slate-400 uppercase sm:text-xs">
                  Manifest Registry
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase italic sm:text-3xl md:text-4xl">
                  Authorized Units
                </h2>
              </div>

              <div className="flex items-end gap-4">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black tracking-widest uppercase transition-colors hover:border-primary lg:hidden"
                >
                  <SlidersHorizontal size={14} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="flex flex-col items-end gap-2 text-right">
                  <label className="sr-only" htmlFor="sort">
                    Sort registry
                  </label>
                  <select
                    id="sort"
                    value={filters.sort}
                    onChange={(event) => applyFilters({ sort: event.target.value as SortOption })}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black tracking-widest uppercase transition-all outline-none focus:border-primary"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mb-1 text-3xl leading-none font-black tracking-tighter text-slate-900 italic md:text-4xl">
                    {pageData.totalItems}
                  </p>
                  <p className="text-[10px] leading-none font-bold tracking-widest text-slate-400 uppercase">
                    Detected Units in Registry
                  </p>
                </div>
              </div>
            </div>

            {loading && pageData.totalItems === 0 ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
              </div>
            ) : pageData.totalItems === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white">
                <EmptyState
                  icon={SearchX}
                  title="Null Search Results"
                  description="The registry could not locate any active artifacts matching your current parameters."
                  actionLabel="Reset Parameters"
                  actionHref="/shop"
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {pageData.items.map((product, index) => (
                    <ProductCard key={product.id} product={product} priority={index < 3} />
                  ))}
                </div>

                <Pagination
                  page={pageData.page}
                  totalPages={pageData.totalPages}
                  onChange={changePage}
                />
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFiltersOpen(false)}
              className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-[1101] w-[88vw] max-w-sm overflow-y-auto bg-slate-50 p-6 lg:hidden"
              role="dialog"
              aria-label="Filters"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-lg font-black tracking-tighter uppercase italic">
                  Registry Parameters
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Close filters"
                  className="cursor-pointer rounded-lg bg-slate-200 p-2 text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>

              <FilterSidebar filters={filters} onChange={applyFilters} onReset={resetFilters} />

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="primary-btn mt-8 w-full"
              >
                Show {pageData.totalItems} Units
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
