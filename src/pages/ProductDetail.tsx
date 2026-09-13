import { motion } from 'framer-motion';
import { Clock, Heart, PackageX, RotateCcw, ShieldCheck, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ProductCard } from '@/components/product/ProductCard';
import { Rating } from '@/components/ui/Rating';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { Seo } from '@/components/ui/Seo';
import { siteConfig } from '@/config/site';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCatalog } from '@/context/CatalogContext';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import { MAX_ORDER_LINES } from '@/services/orders';
import { discountPercent, formatPrice } from '@/lib/money';
import { cn, unitId } from '@/lib/utils';

const TRUST_TILES = [
  { icon: ShieldCheck, label: 'Secure-Boot' },
  { icon: Clock, label: 'Max Clock' },
  { icon: RotateCcw, label: '30D RMA' },
];

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { findBySlug, related: relatedFor, loading } = useCatalog();
  const product = slug ? findBySlug(slug) : undefined;

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const { notify } = useToast();

  const related = useMemo(() => (product ? relatedFor(product, 4) : []), [product, relatedFor]);

  if (!product) {
    // The catalog may still be loading on a cold deep link.
    if (loading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      );
    }
    return <Navigate to="/shop" replace />;
  }

  const discount = discountPercent(product.price, product.compareAtPrice ?? null);
  const outOfStock = product.stock <= 0;
  const saved = has(product.id);

  const handleAdd = async () => {
    const result = await addItem(product.id, quantity);
    if (result === 'unavailable') {
      notify('That component is out of stock.', 'error');
      return;
    }
    if (result === 'capped') {
      notify(`Only ${product.stock} units available — cart set to the maximum.`, 'info');
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
    notify(`${quantity} x ${product.name} added to your hardware cart.`);
  };

  return (
    <div className="tech-grid min-h-screen bg-tech-slate">
      <Seo
        title={product.name}
        description={product.shortDescription}
        image={product.images[0]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          image: product.images,
          description: product.shortDescription,
          sku: product.sku,
          brand: { '@type': 'Brand', name: product.brand },
          ...(product.reviewCount > 0 && product.rating > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: product.rating,
                  reviewCount: product.reviewCount,
                },
              }
            : {}),
          offers: {
            '@type': 'Offer',
            priceCurrency: 'PKR',
            price: (product.price / 100).toFixed(0),
            availability: outOfStock
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: siteConfig.name },
          },
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 font-mono text-[10px] tracking-widest uppercase">
          <ol className="flex flex-wrap items-center gap-2 text-slate-400">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/shop" className="transition-colors hover:text-primary">
                Registry
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                to={`/shop?category=${encodeURIComponent(product.category)}`}
                className="transition-colors hover:text-primary"
              >
                {product.category}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Gallery */}
          <div className="space-y-6 lg:sticky lg:top-32 lg:space-y-10">
            <div className="group relative aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl transition-all hover:border-tech-blue/30 md:p-16">
              <div className="absolute inset-x-6 top-6 z-20 flex items-center justify-between md:inset-x-8 md:top-8">
                <div className="rounded-lg border border-tech-blue/30 bg-tech-blue/10 px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] text-tech-blue uppercase md:px-4 md:text-[10px] md:tracking-[0.3em]">
                  Unit_ID: {unitId(product.id)}
                </div>
                <div className="flex gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-tech-cyan" />
                  <div className="h-2 w-2 animate-pulse rounded-full bg-tech-blue" />
                </div>
              </div>

              <motion.img
                key={activeImage}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                src={product.images[activeImage]}
                alt={`${product.name} — view ${activeImage + 1}`}
                fetchPriority="high"
                className="h-full w-full object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.1)]"
              />

              {discount && (
                <span className="absolute bottom-6 left-6 z-20 rounded-md bg-orange-500 px-3 py-1.5 text-[10px] font-black tracking-widest text-white uppercase">
                  -{discount}% Off
                </span>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="no-scrollbar flex gap-4 overflow-x-auto px-1 pb-2 md:gap-6">
                {product.images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`View image ${index + 1}`}
                    aria-pressed={index === activeImage}
                    className={cn(
                      'h-20 w-20 flex-shrink-0 cursor-pointer rounded-xl border-2 bg-white p-3 transition-all hover:scale-105 active:scale-95 md:h-28 md:w-28 md:p-4',
                      index === activeImage
                        ? 'border-tech-blue shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                        : 'border-slate-100 opacity-60 hover:opacity-100',
                    )}
                  >
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-10 lg:space-y-12 lg:pt-4">
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-wrap items-center gap-4">
                <span className="rounded-lg border border-tech-blue/30 bg-tech-blue/10 px-4 py-2 font-mono text-[10px] font-black tracking-widest text-tech-blue uppercase md:px-6">
                  {product.category}
                </span>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2">
                  <Rating value={product.rating} size={14} />
                  <span className="font-mono text-[9px] tracking-tighter text-slate-400 uppercase">
                    Verified Signals: {product.reviewCount}
                  </span>
                </div>
              </div>

              <h1 className="text-[clamp(2rem,8vw,3.75rem)] leading-[0.95] font-black tracking-tighter text-slate-900 uppercase italic lg:text-6xl">
                {product.name}
              </h1>

              <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                SKU: {product.sku} // Tier: {product.tier} // {product.brand}
              </p>

              <div className="flex flex-wrap items-end gap-4 md:gap-6">
                <p className="gradient-text text-4xl font-black tracking-tighter md:text-5xl">
                  {formatPrice(product.price)}
                </p>
                {product.compareAtPrice && (
                  <p className="mb-2 text-xl font-bold text-slate-400 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </p>
                )}
                <div className="mb-2 hidden h-8 w-[2px] rotate-12 bg-slate-200 sm:block" />
                <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase">
                  Excl. Deployment VAT
                </p>
              </div>
            </div>

            <p className="rounded-r-xl border-l-4 border-tech-blue bg-blue-50 py-3 pl-6 text-base leading-relaxed font-medium text-slate-600 md:pl-8 md:text-xl">
              {product.description}
            </p>

            {/* Highlights */}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {product.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tech-blue" />
                  {highlight}
                </li>
              ))}
            </ul>

            {/* Purchase */}
            <div className="space-y-8 md:space-y-10">
              <div className="flex flex-wrap items-center gap-6 md:gap-10">
                <QuantitySelector
                  value={quantity}
                  max={Math.max(1, product.stock)}
                  onChange={setQuantity}
                />
                <div className="font-mono text-[10px] font-black tracking-[0.2em] uppercase">
                  {outOfStock ? (
                    <span className="flex items-center gap-3 text-rose-500">
                      <PackageX size={14} />
                      Registry Depleted
                    </span>
                  ) : (
                    <span className="flex items-center gap-3 text-tech-cyan">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-tech-cyan" />
                      {product.stock} Units Stable in Inventory
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-4 md:gap-6">
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={outOfStock}
                  className="tech-btn group relative flex h-16 flex-grow items-center justify-center gap-4 overflow-hidden text-base tracking-widest uppercase italic shadow-2xl md:h-20 md:text-xl"
                >
                  <div className="absolute inset-0 translate-x-[-100%] bg-white/10 transition-transform duration-500 group-hover:translate-x-[100%]" />
                  <ShoppingCart size={22} />
                  <span>{outOfStock ? 'Depleted' : 'Initialize Checkout'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void toggle(product.id).then((result) =>
                      notify(
                        result === 'added'
                          ? 'Added to your watchlist.'
                          : 'Removed from your watchlist.',
                        result === 'added' ? 'success' : 'info',
                      ),
                    );
                  }}
                  aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
                  aria-pressed={saved}
                  className={cn(
                    'flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-xl border shadow-xl transition-all hover:scale-105 md:h-20 md:w-20',
                    saved
                      ? 'border-rose-200 bg-rose-50 text-rose-500'
                      : 'border-slate-200 bg-white text-slate-400 hover:border-primary/50 hover:text-primary',
                  )}
                >
                  <Heart size={24} className={saved ? 'fill-rose-500' : undefined} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-8 md:gap-6 md:pt-12">
                {TRUST_TILES.map(({ icon: Icon, label }) => (
                  <div key={label} className="group flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-lg transition-all group-hover:border-tech-blue group-hover:bg-tech-blue group-hover:text-white md:h-16 md:w-16">
                      <Icon size={22} />
                    </div>
                    <p className="font-mono text-[9px] font-black tracking-widest text-slate-400 uppercase md:text-[10px]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Specifications */}
        <section className="mt-24 md:mt-32">
          <h2 className="mb-8 text-2xl font-black tracking-tighter text-slate-900 uppercase italic md:text-3xl">
            Technical <span className="text-tech-blue not-italic">Parameters</span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <dl className="divide-y divide-slate-100">
              {product.specifications.map((spec) => (
                <div
                  key={spec.label}
                  className="grid grid-cols-1 gap-1 px-6 py-4 sm:grid-cols-3 sm:gap-4"
                >
                  <dt className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    {spec.label}
                  </dt>
                  <dd className="font-bold text-slate-900 sm:col-span-2">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <ReviewsSection product={product} />

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-24 md:mt-32">
            <h2 className="mb-10 text-2xl font-black tracking-tighter text-slate-900 uppercase italic md:text-3xl">
              Related <span className="text-primary not-italic">Units</span>
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
