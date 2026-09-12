import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminError,
  AdminPageHeader,
  AdminSpinner,
  TableShell,
  tdClass,
  thClass,
} from '@/components/admin/AdminUI';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { formatPrice } from '@/lib/money';
import { cn } from '@/lib/utils';
import { fetchAllProducts, setProductActive, setProductStock } from '@/services/admin';

type View = 'all' | 'active' | 'archived' | 'low';

export default function AdminProducts() {
  const { notify } = useToast();
  const { refresh } = useCatalog();
  const { data: products, error, loading, reload } = useAsync(() => fetchAllProducts(), 'admin-products');

  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  /** productId -> draft stock value while being edited inline. */
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      const active = product.isActive !== false;
      if (view === 'active' && !active) return false;
      if (view === 'archived' && active) return false;
      if (view === 'low' && (!active || product.stock > 5)) return false;
      if (!term) return true;
      return [product.name, product.sku, product.brand, product.category]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [products, view, search]);

  const afterChange = async (message: string) => {
    notify(message);
    reload();
    await refresh(); // keep the storefront in step
  };

  const saveStock = async (productId: string, name: string) => {
    const raw = stockDrafts[productId];
    const value = Number(raw);
    if (raw === undefined || !Number.isInteger(value) || value < 0) {
      notify('Stock must be a whole number, 0 or more.', 'error');
      return;
    }
    setSavingId(productId);
    try {
      await setProductStock(productId, value);
      setStockDrafts(({ [productId]: _discard, ...rest }) => rest);
      await afterChange(`${name}: stock set to ${value}.`);
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (productId: string, name: string, nextActive: boolean) => {
    setSavingId(productId);
    try {
      await setProductActive(productId, nextActive);
      await afterChange(nextActive ? `${name} is live.` : `${name} archived — hidden from the store.`);
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const views: Array<{ key: View; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Live' },
    { key: 'archived', label: 'Archived' },
    { key: 'low', label: 'Low stock' },
  ];

  return (
    <div>
      <AdminPageHeader eyebrow="// COMPONENT_REGISTRY" title="Product" accent="Catalog">
        <Link to="/admin/products/new" className="primary-btn flex items-center gap-2 px-5 py-2.5 text-sm">
          <Plus size={16} />
          New product
        </Link>
      </AdminPageHeader>

      <AdminError message={error} />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {views.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                'cursor-pointer rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-colors',
                view === key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, SKU, brand, category…"
            className="field-input pl-11"
          />
        </div>
      </div>

      {loading ? (
        <AdminSpinner />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          No products match.
        </p>
      ) : (
        <TableShell>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thClass}>Product</th>
                <th className={thClass}>Category</th>
                <th className={cn(thClass, 'text-right')}>Price</th>
                <th className={thClass}>Stock</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((product) => {
                const active = product.isActive !== false;
                const draft = stockDrafts[product.id];
                const editing = draft !== undefined;
                return (
                  <tr key={product.id} className={cn(!active && 'bg-slate-50/60')}>
                    <td className={tdClass}>
                      <div className="flex items-center gap-3">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1"
                          />
                        ) : (
                          <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100" />
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/admin/products/${product.id}`}
                            className="block max-w-xs truncate font-bold text-slate-900 hover:text-primary"
                          >
                            {product.name}
                          </Link>
                          <p className="font-mono text-[10px] text-slate-400 uppercase">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(tdClass, 'text-slate-600')}>
                      {product.category}
                      <p className="text-xs text-slate-400">{product.tier}</p>
                    </td>
                    <td className={cn(tdClass, 'text-right whitespace-nowrap')}>
                      <p className="font-black">{formatPrice(product.price)}</p>
                      {product.compareAtPrice && (
                        <p className="text-xs text-slate-400 line-through">
                          {formatPrice(product.compareAtPrice)}
                        </p>
                      )}
                    </td>
                    <td className={tdClass}>
                      {editing ? (
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveStock(product.id, product.name);
                          }}
                        >
                          <input
                            type="number"
                            min={0}
                            step={1}
                            autoFocus
                            value={draft}
                            onChange={(event) =>
                              setStockDrafts((current) => ({ ...current, [product.id]: event.target.value }))
                            }
                            aria-label={`Stock for ${product.name}`}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm"
                          />
                          <button
                            type="submit"
                            disabled={savingId === product.id}
                            className="cursor-pointer text-xs font-black text-primary uppercase"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockDrafts(({ [product.id]: _discard, ...rest }) => rest)}
                            className="cursor-pointer text-xs font-bold text-slate-400"
                          >
                            ✕
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setStockDrafts((current) => ({ ...current, [product.id]: String(product.stock) }))
                          }
                          title="Click to adjust stock"
                          className={cn(
                            'cursor-pointer rounded-lg px-2 py-1 font-mono text-sm font-black hover:bg-slate-100',
                            product.stock === 0
                              ? 'text-rose-500'
                              : product.stock <= 5
                                ? 'text-amber-600'
                                : 'text-tech-cyan',
                          )}
                        >
                          {product.stock}
                        </button>
                      )}
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        disabled={savingId === product.id}
                        onClick={() => void toggleActive(product.id, product.name, !active)}
                        className={cn(
                          'cursor-pointer rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase transition-colors disabled:opacity-50',
                          active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300',
                        )}
                        title={active ? 'Click to archive' : 'Click to publish'}
                      >
                        {active ? 'Live' : 'Archived'}
                      </button>
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="text-xs font-black tracking-widest text-primary uppercase"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}
