import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminError, AdminPageHeader, AdminSpinner } from '@/components/admin/AdminUI';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { CATEGORY_ICON_KEYS, resolveIcon } from '@/lib/icons';
import { cn, slugify } from '@/lib/utils';
import {
  CategoryInUseError,
  deleteCategory,
  fetchAllCategories,
  fetchAllProducts,
  saveCategory,
  swapCategoryOrder,
} from '@/services/admin';
import type { Category } from '@/types';

interface Draft {
  /** null when creating. */
  originalName: string | null;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  iconKey: string;
  colorHex: string;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminCategories() {
  const { isAdmin } = useAuth();
  const { refresh } = useCatalog();
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([fetchAllCategories(), fetchAllProducts()]),
    'admin-categories',
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => data?.[0] ?? [], [data]);
  const countOf = useMemo(() => {
    const map = new Map<string, number>();
    (data?.[1] ?? []).forEach((product) => map.set(product.category, (map.get(product.category) ?? 0) + 1));
    return map;
  }, [data]);

  const afterChange = async (message: string) => {
    notify(message);
    reload();
    await refresh();
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      notify(caught instanceof CategoryInUseError ? caught.message : adminErrorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    setFormError('');
    setDraft({
      originalName: null,
      name: '',
      slug: '',
      tagline: '',
      description: '',
      iconKey: 'cpu',
      colorHex: '#3b82f6',
      isActive: true,
      sortOrder: categories.reduce((max, category) => Math.max(max, category.sortOrder ?? 0), -1) + 1,
    });
  };

  const startEdit = (category: Category) => {
    setFormError('');
    setDraft({
      originalName: category.name,
      name: category.name,
      slug: category.slug,
      tagline: category.tagline,
      description: category.description,
      iconKey: category.iconKey,
      colorHex: category.colorHex,
      isActive: category.isActive !== false,
      sortOrder: category.sortOrder ?? 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    const name = draft.name.trim();
    const slug = draft.originalName === null ? slugify(draft.slug || name) : draft.slug;
    if (name.length < 2) return setFormError('Name must be at least 2 characters.');
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) return setFormError('URL slug: 2–60 lowercase letters, digits or dashes.');
    if (categories.some((category) => category.slug !== slug && category.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`A category called "${name}" already exists.`);
    }
    if (draft.originalName === null && categories.some((category) => category.slug === slug)) {
      return setFormError(`The slug "${slug}" is already taken.`);
    }

    const renaming = draft.originalName !== null && draft.originalName !== name;
    const affected = renaming ? (countOf.get(draft.originalName ?? '') ?? 0) : 0;
    if (renaming && affected > 0 && !window.confirm(`Rename "${draft.originalName}" to "${name}"? ${affected} product${affected === 1 ? '' : 's'} will move with it.`)) {
      return;
    }

    setFormError('');
    await run(async () => {
      const moved = await saveCategory(
        {
          name,
          slug,
          tagline: draft.tagline,
          description: draft.description,
          iconKey: draft.iconKey,
          colorHex: draft.colorHex,
          isActive: draft.isActive,
          sortOrder: draft.sortOrder,
        },
        draft.originalName,
      );
      setDraft(null);
      await afterChange(
        draft.originalName === null
          ? `${name} created.`
          : moved > 0
            ? `${name} saved — ${moved} product${moved === 1 ? '' : 's'} updated.`
            : `${name} saved.`,
      );
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const current = categories[index];
    const other = categories[index + direction];
    if (!current || !other) return;
    void run(async () => {
      // If two categories share a sort value, spread them out first.
      const a = { ...current, sortOrder: current.sortOrder === other.sortOrder ? index : current.sortOrder };
      const b = { ...other, sortOrder: current.sortOrder === other.sortOrder ? index + direction : other.sortOrder };
      await swapCategoryOrder(a, b);
      await afterChange('Order updated.');
    });
  };

  const toggleActive = (category: Category) =>
    void run(async () => {
      await saveCategory({ ...category, isActive: category.isActive === false }, null);
      await afterChange(category.isActive === false ? `${category.name} is visible.` : `${category.name} hidden from the store.`);
    });

  const remove = (category: Category) => {
    if (!window.confirm(`Delete "${category.name}"?`)) return;
    void run(async () => {
      await deleteCategory(category);
      await afterChange(`${category.name} deleted.`);
    });
  };

  const DraftIcon = draft ? resolveIcon(draft.iconKey) : null;

  return (
    <div>
      <AdminPageHeader eyebrow="// REGISTRY_STRUCTURE" title="Product" accent="Categories">
        {!draft && (
          <button type="button" onClick={startCreate} className="primary-btn flex items-center gap-2 px-5 py-2.5 text-sm">
            <Plus size={16} /> New category
          </button>
        )}
      </AdminPageHeader>

      <AdminError message={error} />

      {draft && DraftIcon && (
        <form onSubmit={(event) => void submit(event)} className="mb-8 space-y-5 rounded-2xl border border-primary/20 bg-white p-6" noValidate>
          <h2 className="text-sm font-black tracking-widest uppercase">
            {draft.originalName === null ? 'New category' : `Edit ${draft.originalName}`}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="terminal-label text-slate-500">Name</span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          name: event.target.value,
                          slug: current.originalName === null ? slugify(event.target.value) : current.slug,
                        }
                      : current,
                  )
                }
                className="field-input"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="terminal-label text-slate-500">URL slug {draft.originalName !== null && '(fixed)'}</span>
              <input
                value={draft.slug}
                disabled={draft.originalName !== null}
                onChange={(event) => setDraft((current) => (current ? { ...current, slug: event.target.value } : current))}
                className="field-input font-mono disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="terminal-label text-slate-500">Tagline</span>
              <input
                value={draft.tagline}
                maxLength={80}
                onChange={(event) => setDraft((current) => (current ? { ...current, tagline: event.target.value } : current))}
                placeholder="e.g. Computing Units"
                className="field-input"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="terminal-label text-slate-500">Accent colour</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={draft.colorHex}
                  onChange={(event) => setDraft((current) => (current ? { ...current, colorHex: event.target.value } : current))}
                  className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200"
                />
                <span className="font-mono text-sm text-slate-500">{draft.colorHex}</span>
              </div>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="terminal-label text-slate-500">Description (shown on the homepage card)</span>
            <textarea
              rows={2}
              value={draft.description}
              maxLength={300}
              onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))}
              className="field-input resize-none"
            />
          </label>

          <div className="space-y-2">
            <span className="terminal-label text-slate-500">Icon</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_KEYS.map((key) => {
                const Icon = resolveIcon(key);
                const selected = draft.iconKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((current) => (current ? { ...current, iconKey: key } : current))}
                    title={key}
                    aria-label={key}
                    aria-pressed={selected}
                    className={cn(
                      'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors',
                      selected ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400',
                    )}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => (current ? { ...current, isActive: event.target.checked } : current))}
              className="h-4 w-4 accent-primary"
            />
            Visible in the store
          </label>

          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ backgroundColor: draft.colorHex }}>
              <DraftIcon size={22} />
            </div>
            <div>
              <p className="font-black tracking-tight uppercase italic">{draft.name || 'Preview'}</p>
              <p className="text-xs text-slate-500">{draft.tagline || 'Tagline'}</p>
            </div>
          </div>

          <AdminError message={formError} />
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="primary-btn px-6 py-2.5 text-sm">
              {busy ? 'Saving…' : 'Save category'}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="secondary-btn px-6 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <AdminSpinner />
      ) : categories.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">No categories yet.</p>
      ) : (
        <ul className="space-y-3">
          {categories.map((category, index) => {
            const Icon = resolveIcon(category.iconKey);
            const count = countOf.get(category.name) ?? 0;
            const hidden = category.isActive === false;
            return (
              <li
                key={category.slug}
                className={cn('flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4', hidden && 'opacity-60')}
              >
                <div className="flex flex-col">
                  <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${category.name} up`} className="cursor-pointer rounded p-1 text-slate-400 hover:text-primary disabled:cursor-default disabled:opacity-30">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" disabled={busy || index === categories.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${category.name} down`} className="cursor-pointer rounded p-1 text-slate-400 hover:text-primary disabled:cursor-default disabled:opacity-30">
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: category.colorHex }}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="font-black text-slate-900">
                    {category.name}
                    {hidden && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-600 uppercase">Hidden</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    /{category.slug} · {count} product{count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button type="button" disabled={busy} onClick={() => toggleActive(category)} title={hidden ? 'Show in store' : 'Hide from store'} aria-label={hidden ? `Show ${category.name}` : `Hide ${category.name}`} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary">
                    {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button type="button" disabled={busy} onClick={() => startEdit(category)} title="Edit" aria-label={`Edit ${category.name}`} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary">
                    <Pencil size={16} />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busy || count > 0}
                      onClick={() => remove(category)}
                      title={count > 0 ? 'Move or delete its products first' : 'Delete'}
                      aria-label={`Delete ${category.name}`}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        Hidden categories disappear from the homepage and shop filters; their products stay live unless you archive them.
        Renaming moves every product in the category to the new name.
      </p>
    </div>
  );
}
