import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { useCatalog } from '@/context/CatalogContext';
import { formatPrice } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * "Full Inventory Manifest" — a dense, scannable table of the whole catalog,
 * as an alternative to the card grid on /shop.
 */
export default function Inventory() {
  const { products, categories } = useCatalog();

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo
        title="Full Inventory Manifest"
        description="Complete registry of every indexed hardware unit with live stock levels."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10 space-y-2 md:mb-14">
          <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
            // FULL_REGISTRY_DUMP
          </p>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
            Inventory <span className="text-primary not-italic">Manifest</span>
          </h1>
          <p className="max-w-2xl font-medium text-slate-500">
            {products.length} units indexed across {categories.length} departments.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Component', 'SKU', 'Department', 'Tier', 'Stock', 'Valuation'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-6 py-4 font-mono text-[10px] tracking-widest text-slate-400 uppercase"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/product/${product.slug}`}
                      className="font-bold text-slate-900 transition-colors hover:text-primary"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{product.sku}</td>
                  <td className="px-6 py-4 text-slate-600">{product.category}</td>
                  <td className="px-6 py-4 text-slate-600">{product.tier}</td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'font-mono text-xs font-black',
                        product.stock === 0
                          ? 'text-rose-500'
                          : product.stock <= 5
                            ? 'text-amber-500'
                            : 'text-tech-cyan',
                      )}
                    >
                      {product.stock === 0 ? 'DEPLETED' : `${product.stock} UNITS`}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black whitespace-nowrap text-slate-900">
                    {formatPrice(product.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
