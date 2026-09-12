import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  AdminError,
  AdminPageHeader,
  AdminSpinner,
  TableShell,
  tdClass,
  thClass,
} from '@/components/admin/AdminUI';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { formatPrice, rupeesToPaisa } from '@/lib/money';
import { cn } from '@/lib/utils';
import { deleteCoupon, fetchAllCoupons, saveCoupon } from '@/services/admin';
import type { Coupon } from '@/types';

interface Draft {
  code: string;
  type: 'percentage' | 'fixed';
  value: string;
  minOrder: string;
  maxDiscount: string;
  description: string;
}

const EMPTY: Draft = { code: '', type: 'percentage', value: '', minOrder: '0', maxDiscount: '', description: '' };

function describe(coupon: Coupon): string {
  const off = coupon.type === 'percentage' ? `${coupon.value}% off` : `${formatPrice(coupon.value)} off`;
  const min = coupon.minOrderAmount > 0 ? ` above ${formatPrice(coupon.minOrderAmount)}` : '';
  const cap = coupon.maxDiscountAmount ? `, max ${formatPrice(coupon.maxDiscountAmount)}` : '';
  return `${off}${min}${cap}`;
}

export default function AdminCoupons() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const { data: coupons, error, loading, reload } = useAsync(() => fetchAllCoupons(), 'admin-coupons');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    const code = draft.code.trim().toUpperCase();
    const value = Number(draft.value);
    const minOrder = Number(draft.minOrder || '0');
    const maxDiscount = draft.maxDiscount.trim() ? Number(draft.maxDiscount) : null;

    // Mirrors validCoupon() in firestore.rules.
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return setFormError('Code: 2–40 letters, digits, - or _.');
    if (coupons?.some((coupon) => coupon.code === code)) return setFormError(`${code} already exists.`);
    if (draft.type === 'percentage' && (!Number.isInteger(value) || value < 1 || value > 100)) {
      return setFormError('Percentage must be a whole number from 1 to 100.');
    }
    if (draft.type === 'fixed' && (!Number.isFinite(value) || value <= 0)) {
      return setFormError('Amount off must be more than 0.');
    }
    if (!Number.isFinite(minOrder) || minOrder < 0) return setFormError('Minimum order cannot be negative.');
    if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
      return setFormError('Maximum discount must be more than 0, or blank for no cap.');
    }

    setBusy(true);
    setFormError('');
    try {
      await saveCoupon({
        code,
        type: draft.type,
        value: draft.type === 'percentage' ? value : rupeesToPaisa(value),
        minOrderAmount: rupeesToPaisa(minOrder),
        ...(maxDiscount !== null ? { maxDiscountAmount: rupeesToPaisa(maxDiscount) } : {}),
        description: draft.description.trim(),
        isActive: true,
      });
      notify(`${code} created.`);
      setDraft(null);
      reload();
    } catch (caught) {
      setFormError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (coupon: Coupon) => {
    setBusy(true);
    try {
      await saveCoupon({ ...coupon, isActive: coupon.isActive === false });
      notify(`${coupon.code} ${coupon.isActive === false ? 'activated' : 'paused'}.`);
      reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (coupon: Coupon) => {
    if (!window.confirm(`Delete ${coupon.code}? Past orders that used it are unaffected.`)) return;
    setBusy(true);
    try {
      await deleteCoupon(coupon.code);
      notify(`${coupon.code} deleted.`);
      reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div>
      <AdminPageHeader eyebrow="// DISCOUNT_PROTOCOLS" title="Coupon" accent="Codes">
        {isAdmin && !draft && (
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setFormError('');
            }}
            className="primary-btn flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Plus size={16} /> New coupon
          </button>
        )}
      </AdminPageHeader>

      <AdminError message={error} />
      {!isAdmin && (
        <p className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-500">
          You can view coupons. Creating and editing them requires the ADMIN role.
        </p>
      )}

      {draft && (
        <form
          onSubmit={(event) => void create(event)}
          className="mb-8 space-y-4 rounded-2xl border border-primary/20 bg-white p-6"
          noValidate
        >
          <h2 className="text-sm font-black tracking-widest uppercase">New coupon</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1.5">
              <span className="terminal-label text-slate-500">Code</span>
              <input
                value={draft.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                placeholder="EID15"
                className="field-input font-mono uppercase"
              />
            </label>
            <label className="space-y-1.5">
              <span className="terminal-label text-slate-500">Type</span>
              <select
                value={draft.type}
                onChange={(e) => update('type', e.target.value)}
                className="field-input cursor-pointer"
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="terminal-label text-slate-500">
                {draft.type === 'percentage' ? 'Percent (1–100)' : 'Amount off (Rs.)'}
              </span>
              <input
                type="number"
                min={0}
                value={draft.value}
                onChange={(e) => update('value', e.target.value)}
                className="field-input font-mono"
              />
            </label>
            <label className="space-y-1.5">
              <span className="terminal-label text-slate-500">Minimum order (Rs.)</span>
              <input
                type="number"
                min={0}
                value={draft.minOrder}
                onChange={(e) => update('minOrder', e.target.value)}
                className="field-input font-mono"
              />
            </label>
            <label className="space-y-1.5">
              <span className="terminal-label text-slate-500">Max discount (Rs., optional)</span>
              <input
                type="number"
                min={0}
                value={draft.maxDiscount}
                onChange={(e) => update('maxDiscount', e.target.value)}
                placeholder="No cap"
                className="field-input font-mono"
              />
            </label>
            <label className="space-y-1.5">
              <span className="terminal-label text-slate-500">Note (internal)</span>
              <input
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                className="field-input"
              />
            </label>
          </div>
          <AdminError message={formError} />
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="primary-btn px-6 py-2.5 text-sm">
              {busy ? 'Saving…' : 'Create coupon'}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="secondary-btn px-6 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <AdminSpinner />
      ) : !coupons?.length ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          No coupons yet.
        </p>
      ) : (
        <TableShell>
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thClass}>Code</th>
                <th className={thClass}>Discount</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((coupon) => {
                const active = coupon.isActive !== false;
                return (
                  <tr key={coupon.code} className={cn(!active && 'bg-slate-50/60')}>
                    <td className={cn(tdClass, 'font-mono font-black text-primary')}>{coupon.code}</td>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-700">{describe(coupon)}</p>
                      {coupon.description && <p className="text-xs text-slate-400">{coupon.description}</p>}
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        disabled={!isAdmin || busy}
                        onClick={() => void toggle(coupon)}
                        className={cn(
                          'rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase transition-colors enabled:cursor-pointer',
                          active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600',
                        )}
                        title={isAdmin ? (active ? 'Click to pause' : 'Click to activate') : undefined}
                      >
                        {active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(coupon)}
                          aria-label={`Delete ${coupon.code}`}
                          className="cursor-pointer rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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
