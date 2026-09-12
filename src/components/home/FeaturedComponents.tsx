import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '@/components/product/ProductCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { useCatalog } from '@/context/CatalogContext';

export function FeaturedComponents() {
  const { featured } = useCatalog();
  const items = featured(4);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <SectionHeading
        label="Inventory Manifest"
        title="Featured"
        accent="Components"
        description="Our most reliable and high-performance hardware, currently in stock and ready for deployment."
      >
        <Link
          to="/shop"
          className="flex shrink-0 items-center gap-2 border-b-2 border-primary/20 pb-2 font-bold text-primary transition-all hover:gap-4"
        >
          Browse Full Registry
          <ArrowRight size={18} />
        </Link>
      </SectionHeading>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {items.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 2} />
        ))}
      </div>
    </section>
  );
}
