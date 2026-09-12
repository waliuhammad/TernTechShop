import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminError, AdminSpinner } from '@/components/admin/AdminUI';
import { ImageManager } from '@/components/admin/ImageManager';
import { performanceTiers } from '@/config/site';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { rupeesToPaisa, toMajorUnits } from '@/lib/money';
import { cn, slugify } from '@/lib/utils';
import { deleteProduct, fetchProduct, saveProduct, SlugTakenError, type ProductInput } from '@/services/admin';
import type { Product } from '@/types';

/** Everything the form edits, as strings — converted and validated on save. */
interface FormState {
  name: string;
  slug: string;
  slugTouched: boolean;
  sku: string;
  brand: string;
  category: string;
  tier: Product['tier'];
  price: string;
  compareAtPrice: string;
  stock: string;
  shortDescription: string;
  description: string;
  highlights: string;
  specifications: string;
  images: string;
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
}

function toForm(product: Product | null, defaultCategory: string): FormState {
  return {
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    slugTouched: Boolean(product),
    sku: product?.sku ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? defaultCategory,
    tier: product?.tier ?? 'Essential',
    price: product ? String(toMajorUnits(product.price)) : '',
    compareAtPrice: product?.compareAtPrice ? String(toMajorUnits(product.compareAtPrice)) : '',
    stock: product ? String(product.stock) : '0',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    highlights: (product?.highlights ?? []).join('\n'),
    specifications: (product?.specifications ?? []).map((s) => `${s.label}: ${s.value}`).join('\n'),
    images: (product?.images ?? []).filter(Boolean).join('\n'),
    isFeatured: product?.isFeatured ?? false,
    isNew: product?.isNew ?? !product,
    isActive: product?.isActive ?? true,
  };
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Converts and validates the form. Mirrors validProduct() in firestore.rules
 * so staff see a readable message here instead of a bare permission error.
 */
function toInput(form: FormState): { input?: ProductInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const price = Number(form.price);
  const compare = form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null;
  const stock = Number(form.stock);
  const images = lines(form.images);

  if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  if (slugify(form.slug).length < 2) errors.slug = 'URL slug must be at least 2 characters.';
  if (!form.sku.trim()) errors.sku = 'SKU is required.';
  if (!form.category) errors.category = 'Choose a category.';
  if (!Number.isFinite(price) || price <= 0) errors.price = 'Price must be more than 0.';
  if (compare !== null && (!Number.isFinite(compare) || compare <= price)) {
    errors.compareAtPrice = '"Was" price must be higher than the selling price — or leave it blank.';
  }
  if (!Number.isInteger(stock) || stock < 0) errors.stock = 'Stock must be a whole number, 0 or more.';
  if (images.length > 12) errors.images = 'At most 12 images.';
  const badUrl = images.find((url) => !/^https?:\/\//i.test(url) && !url.startsWith('/'));
  if (badUrl) errors.images = `Not a valid image URL: ${badUrl}`;

  const specifications = lines(form.specifications).map((line) => {
    const index = line.indexOf(':');
    return index === -1
      ? { label: line, value: '' }
      : { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
  });

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    input: {
      name: form.name.trim(),
      slug: slugify(form.slug),
      sku: form.sku.trim().toUpperCase(),
      brand: form.brand.trim(),
      category: form.category,
      tier: form.tier,
      price: rupeesToPaisa(price),
      compareAtPrice: compare === null ? null : rupeesToPaisa(compare),
      stock,
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      highlights: lines(form.highlights),
      specifications,
      images,
      isFeatured: form.isFeatured,
      isNew: form.isNew,
      isActive: form.isActive,
    },
  };
}

export default function ProductEditor() {
  const { productId } = useParams<{ productId: string }>();
  const isNew = !productId;

  const { data: product, error, loading } = useAsync(
    () => (productId ? fetchProduct(productId) : Promise.resolve(null)),
    `product-${productId ?? 'new'}`,
  );

  if (loading) return <AdminSpinner />;
  if (!isNew && !product) {
    return (
      <div className="space-y-4">
        <AdminError message={error || 'Product not found.'} />
        <Link to="/admin/products" className="secondary-btn inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to products
        </Link>
      </div>
    );
  }

  // Keyed so switching between products starts a fresh form.
  return <EditorForm key={productId ?? 'new'} productId={productId ?? null} product={product ?? null} />;
}

function EditorForm({ productId, product }: { productId: string | null; product: Product | null }) {
  const { isAdmin } = useAuth();
  const { categories, refresh } = useCatalog();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(() => toForm(product, categories[0]?.name ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Derive the slug from the name until someone edits the slug directly.
      if (key === 'name' && !current.slugTouched) next.slug = slugify(String(value));
      if (key === 'slug') next.slugTouched = true;
      return next;
    });
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const { input, errors: found } = toInput(form);
    setErrors(found);
    if (!input) {
      notify('Fix the highlighted fields.', 'error');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await saveProduct(productId, input);
      await refresh();
      notify(productId ? `${input.name} updated.` : `${input.name} created.`);
      navigate('/admin/products');
    } catch (caught) {
      if (caught instanceof SlugTakenError) {
        setErrors((current) => ({ ...current, slug: caught.message }));
      }
      setSaveError(caught instanceof SlugTakenError ? caught.message : adminErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!productId || !product) return;
    if (!window.confirm(`Permanently delete "${product.name}"? Past orders keep their copy. Consider archiving instead.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteProduct(productId);
      await refresh();
      notify(`${product.name} deleted.`);
      navigate('/admin/products');
    } catch (caught) {
      setSaveError(adminErrorMessage(caught));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6" noValidate>
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-slate-400 uppercase hover:text-primary"
      >
        <ArrowLeft size={14} /> All products
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-4xl">
          {productId ? 'Edit' : 'New'} <span className="text-primary not-italic">Component</span>
        </h1>
        <div className="flex gap-3">
          {productId && product && (
            <a
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary-btn px-4 py-2.5 text-sm"
            >
              View in store
            </a>
          )}
          <button type="submit" disabled={saving || uploading} className="primary-btn px-6 py-2.5 text-sm">
            {uploading ? 'Uploading…' : saving ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </div>

      <AdminError message={saveError} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Identity">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name} className="sm:col-span-2">
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="field-input" />
              </Field>
              <Field label="URL slug" error={errors.slug} hint={`/product/${slugify(form.slug) || '…'}`}>
                <input value={form.slug} onChange={(e) => set('slug', e.target.value)} className="field-input font-mono" />
              </Field>
              <Field label="SKU" error={errors.sku}>
                <input value={form.sku} onChange={(e) => set('sku', e.target.value)} className="field-input font-mono uppercase" />
              </Field>
              <Field label="Brand">
                <input value={form.brand} onChange={(e) => set('brand', e.target.value)} className="field-input" />
              </Field>
              <Field label="Category" error={errors.category}>
                <select value={form.category} onChange={(e) => set('category', e.target.value)} className="field-input cursor-pointer">
                  {categories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Performance tier">
                <select
                  value={form.tier}
                  onChange={(e) => set('tier', e.target.value as Product['tier'])}
                  className="field-input cursor-pointer"
                >
                  {performanceTiers.map((tier) => (
                    <option key={tier.key} value={tier.label}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Copy">
            <div className="space-y-4">
              <Field label="Short description" hint="One line — shown in search and link previews.">
                <input
                  value={form.shortDescription}
                  onChange={(e) => set('shortDescription', e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="field-input resize-y"
                />
              </Field>
              <Field label="Highlights" hint="One per line.">
                <textarea
                  rows={4}
                  value={form.highlights}
                  onChange={(e) => set('highlights', e.target.value)}
                  className="field-input resize-y"
                />
              </Field>
              <Field label="Specifications" hint='One per line, as "Label: Value" — e.g. "Memory: 16GB GDDR6X".'>
                <textarea
                  rows={5}
                  value={form.specifications}
                  onChange={(e) => set('specifications', e.target.value)}
                  className="field-input resize-y font-mono text-xs"
                />
              </Field>
            </div>
          </Card>

          <Card title="Images">
            <ImageManager
              images={lines(form.images)}
              onChange={(next) => set('images', next.join('\n'))}
              onUploadingChange={setUploading}
              error={errors.images}
            />
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Pricing & stock">
            <div className="space-y-4">
              <Field label="Price (Rs.)" error={errors.price}>
                <input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  className="field-input font-mono"
                />
              </Field>
              <Field label='"Was" price (Rs.)' error={errors.compareAtPrice} hint="Optional. Shows a sale badge.">
                <input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  value={form.compareAtPrice}
                  onChange={(e) => set('compareAtPrice', e.target.value)}
                  className="field-input font-mono"
                />
              </Field>
              <Field label="Units in stock" error={errors.stock}>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.stock}
                  onChange={(e) => set('stock', e.target.value)}
                  className="field-input font-mono"
                />
              </Field>
            </div>
          </Card>

          <Card title="Visibility">
            <div className="space-y-3">
              <Toggle label="Live in store" checked={form.isActive} onChange={(v) => set('isActive', v)} />
              <Toggle label="Featured on homepage" checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} />
              <Toggle label="Show 'New' badge" checked={form.isNew} onChange={(v) => set('isNew', v)} />
            </div>
          </Card>

          {productId && isAdmin && (
            <Card title="Danger zone">
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 py-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={16} /> Delete product
              </button>
              <p className="mt-2 text-xs text-slate-400">
                Archiving (turn off “Live in store”) is usually better — it can be undone.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-black tracking-widest text-slate-900 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="terminal-label text-slate-500">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs font-bold text-rose-500">{error}</span>
      ) : (
        hint && <span className="block text-xs text-slate-400">{hint}</span>
      )}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 cursor-pointer accent-primary"
      />
    </label>
  );
}
