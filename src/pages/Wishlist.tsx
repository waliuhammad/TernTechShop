import { Heart } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Seo } from '@/components/ui/Seo';
import { useWishlist } from '@/context/WishlistContext';

export default function Wishlist() {
  const { items, clear } = useWishlist();

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo noindex title="Saved Components" description="Your curated list of high-performance hardware." />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-16">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
              // WATCHLIST_REGISTRY
            </p>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
              Saved <span className="text-primary not-italic">Components</span>
            </h1>
            <p className="font-medium text-slate-400 italic">
              Your curated list of high-performance hardware.
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void clear()}
              className="cursor-pointer text-[10px] font-black tracking-widest text-slate-400 uppercase transition-colors hover:text-rose-500"
            >
              Clear Watchlist
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white">
            <EmptyState
              icon={Heart}
              title="Your watchlist is empty!"
              description="It seems you haven't saved any hardware components yet. Let's explore the catalog to find your next upgrade!"
              actionLabel="Discover Hardware"
              actionHref="/shop"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {items.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
