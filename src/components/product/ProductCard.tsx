import { Eye, Heart, ShoppingCart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Rating } from '@/components/ui/Rating';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useWishlist } from '@/context/WishlistContext';
import { discountPercent, formatPrice } from '@/lib/money';
import { cn } from '@/lib/utils';
import { MAX_ORDER_LINES } from '@/services/orders';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  /** Skips lazy-loading for the first row so the LCP image is not deferred. */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const { notify } = useToast();
  const navigate = useNavigate();

  const discount = discountPercent(product.price, product.compareAtPrice ?? null);
  const outOfStock = product.stock <= 0;
  const saved = has(product.id);

  const handleAdd = async () => {
    const result = await addItem(product.id, 1);
    if (result === 'unavailable') {
      notify('That component is out of stock.', 'error');
      return;
    }
    if (result === 'capped') {
      notify(`Only ${product.stock} units available — cart updated to the maximum.`, 'info');
      return;
    }
    if (result === 'line-limit') {
      notify(`A manifest carries at most ${MAX_ORDER_LINES} distinct components.`, 'error');
      return;
    }
    if (result === 'suspended') {
      notify('This account is suspended and cannot place orders. Contact support.', 'error');
      return;
    }
    if (result === 'error') {
      notify('Could not update your cart. Please try again.', 'error');
      return;
    }
    notify(`${product.name} added to your hardware cart.`);
  };

  const handleWishlist = async () => {
    const result = await toggle(product.id);
    notify(
      result === 'added' ? 'Added to your watchlist.' : 'Removed from your watchlist.',
      result === 'added' ? 'success' : 'info',
    );
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20">
      {/* Media */}
      <div className="relative aspect-[4/5] overflow-hidden bg-white">
        <Link
          to={`/product/${product.slug}`}
          className="flex h-full w-full items-center justify-center p-8"
          aria-label={product.name}
        >
          <img
            src={product.images[0]}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            width={600}
            height={750}
            className="z-10 h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-slate-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* One badge only, in priority order. */}
        {outOfStock ? (
          <span className="absolute top-4 left-4 z-20 rounded-sm bg-slate-900 px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
            Depleted
          </span>
        ) : discount ? (
          <span className="badge-sale">-{discount}%</span>
        ) : product.isNew ? (
          <span className="badge-new">New</span>
        ) : product.isFeatured ? (
          <span className="badge-featured">Featured</span>
        ) : null}

        {/* Quick actions slide up on hover; always visible on touch. */}
        <div className="absolute inset-x-4 bottom-4 z-30 flex translate-y-24 gap-2 transition-all duration-500 group-hover:translate-y-0 group-focus-within:translate-y-0 max-lg:translate-y-0">
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={outOfStock}
            className="flex flex-grow cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-[10px] font-black tracking-widest text-white uppercase shadow-lg transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShoppingCart size={14} />
            {outOfStock ? 'Depleted' : 'Deploy'}
          </button>

          <button
            type="button"
            onClick={() => void handleWishlist()}
            aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
            aria-pressed={saved}
            className={cn(
              'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-lg transition-all',
              saved
                ? 'border-rose-200 bg-rose-50 text-rose-500'
                : 'border-slate-200 bg-white text-slate-400 hover:text-rose-500',
            )}
          >
            <Heart size={16} className={saved ? 'fill-rose-500' : undefined} />
          </button>

          <button
            type="button"
            onClick={() => navigate(`/product/${product.slug}`)}
            aria-label={`View ${product.name}`}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-lg transition-all hover:text-primary"
          >
            <Eye size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-grow flex-col space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            {product.category}
          </span>
          <Rating value={product.rating} />
        </div>

        <h3 className="min-h-[3rem] text-lg font-bold text-slate-900 transition-colors group-hover:text-primary">
          <Link to={`/product/${product.slug}`} className="line-clamp-2">
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-50 pt-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-black tracking-tighter text-slate-900">
              {formatPrice(product.price)}
            </p>
            {product.compareAtPrice && (
              <p className="truncate text-xs font-bold text-slate-400 line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            )}
          </div>
          <span
            className={cn(
              'shrink-0 font-mono text-[10px] font-bold tracking-widest uppercase',
              outOfStock ? 'text-rose-500' : 'text-tech-cyan',
            )}
          >
            {outOfStock ? 'Depleted' : `${product.stock} Units`}
          </span>
        </div>
      </div>
    </article>
  );
}
