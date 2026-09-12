import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AdminError, AdminPageHeader, AdminSpinner } from '@/components/admin/AdminUI';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { formatPrice, rupeesToPaisa, toMajorUnits } from '@/lib/money';
import { fetchLogistics, saveLogistics, type LogisticsSettings } from '@/services/settings';
import type { ShippingZone } from '@/types';

const MAX_ZONES = 12;

export default function AdminSettings() {
  const { data, error, loading } = useAsync(() => fetchLogistics(), 'admin-settings');

  return (
    <div>
      <AdminPageHeader eyebrow="// LOGISTICS_PROTOCOLS" title="Store" accent="Settings" />
      <AdminError message={error} />
      {loading || !data ? <AdminSpinner /> : <LogisticsForm initial={data} />}
    </div>
  );
}

function LogisticsForm({ initial }: { initial: LogisticsSettings }) {
  const { isAdmin } = useAuth();
  const { refresh } = useSettings();
  const { notify } = useToast();

  const [fee, setFee] = useState(String(toMajorUnits(initial.standardShippingFee)));
  const [threshold, setThreshold] = useState(String(toMajorUnits(initial.freeShippingThreshold)));
  const [zones, setZones] = useState<ShippingZone[]>(initial.zones);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const feeValue = Number(fee);
  const thresholdValue = Number(threshold);

  const updateZone = (index: number, key: keyof ShippingZone, value: string) =>
    setZones((current) => current.map((zone, i) => (i === index ? { ...zone, [key]: value } : zone)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(feeValue) || feeValue < 0 || feeValue > 100000) {
      return setFormError('Shipping fee must be between Rs. 0 and Rs. 100,000.');
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 10000000) {
      return setFormError('Free-shipping threshold must be between Rs. 0 and Rs. 10,000,000.');
    }
    const cleanZones = zones
      .map((zone) => ({
        sector: zone.sector.trim(),
        deliveryWindow: zone.deliveryWindow.trim(),
        carrier: zone.carrier.trim(),
      }))
      .filter((zone) => zone.sector);
    if (cleanZones.length === 0) return setFormError('Keep at least one delivery zone.');

    setFormError('');
    setBusy(true);
    try {
      await saveLogistics({
        standardShippingFee: rupeesToPaisa(feeValue),
        freeShippingThreshold: rupeesToPaisa(thresholdValue),
        zones: cleanZones,
      });
      await refresh();
      setZones(cleanZones);
      notify('Settings saved. They apply to the next order.');
    } catch (caught) {
      setFormError(adminErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="max-w-3xl space-y-6" noValidate>
      {!isAdmin && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-500">
          You can view settings. Changing them requires the ADMIN role.
        </p>
      )}

      <fieldset disabled={!isAdmin || busy} className="space-y-6">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-black tracking-widest uppercase">Shipping charges</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="terminal-label text-slate-500">Standard shipping fee (Rs.)</span>
              <input type="number" min={0} step={1} value={fee} onChange={(event) => setFee(event.target.value)} className="field-input font-mono" />
            </label>
            <label className="block space-y-1.5">
              <span className="terminal-label text-slate-500">Free shipping from (Rs.)</span>
              <input type="number" min={0} step={1} value={threshold} onChange={(event) => setThreshold(event.target.value)} className="field-input font-mono" />
            </label>
          </div>
          {Number.isFinite(feeValue) && Number.isFinite(thresholdValue) && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Orders under <strong>{formatPrice(rupeesToPaisa(thresholdValue))}</strong> (after any discount) pay{' '}
              <strong>{formatPrice(rupeesToPaisa(feeValue))}</strong> shipping; orders at or above it ship free.
              {thresholdValue === 0 && ' With a threshold of 0, every order ships free.'}
            </p>
          )}
          <p className="text-xs text-slate-400">
            The server checks every order against these exact values, so what the cart shows and what is accepted always match.
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-sm font-black tracking-widest uppercase">Delivery zones</h2>
            <p className="mt-1 text-xs text-slate-400">
              Shown on the Logistics page and used at checkout to estimate delivery. A city is matched against each sector
              name; anything unmatched falls into the last zone, so keep a catch-all like “All Other Cities” at the bottom.
            </p>
          </div>

          <div className="space-y-3">
            {zones.map((zone, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center">
                <input value={zone.sector} onChange={(event) => updateZone(index, 'sector', event.target.value)} placeholder="Sector, e.g. Lahore / Karachi" aria-label={`Zone ${index + 1} sector`} className="field-input" />
                <input value={zone.deliveryWindow} onChange={(event) => updateZone(index, 'deliveryWindow', event.target.value)} placeholder="2-3 Days" aria-label={`Zone ${index + 1} delivery window`} className="field-input" />
                <input value={zone.carrier} onChange={(event) => updateZone(index, 'carrier', event.target.value)} placeholder="Carrier" aria-label={`Zone ${index + 1} carrier`} className="field-input" />
                <button
                  type="button"
                  onClick={() => setZones((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove zone ${index + 1}`}
                  className="cursor-pointer justify-self-end rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {zones.length < MAX_ZONES && (
            <button
              type="button"
              onClick={() => setZones((current) => [...current, { sector: '', deliveryWindow: '', carrier: '' }])}
              className="flex cursor-pointer items-center gap-2 text-sm font-black text-primary"
            >
              <Plus size={16} /> Add zone
            </button>
          )}
        </section>

        <AdminError message={formError} />

        {isAdmin && (
          <button type="submit" disabled={busy} className="primary-btn px-8 py-3 text-sm">
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        )}
      </fieldset>
    </form>
  );
}
