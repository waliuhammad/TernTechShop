import { Heart, KeyRound, LogOut, MapPin, Package, Pencil, Plus, Star, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { authErrorMessage, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/lib/utils';
import {
  deleteAddress,
  fetchAddresses,
  MAX_ADDRESSES,
  saveAddress,
  type AddressInput,
  type SavedAddress,
} from '@/services/addresses';

const PHONE_PATTERN = /^(\+92|0)?3\d{9}$/;
const EMPTY_ADDRESS: AddressInput = { label: '', fullName: '', phone: '', address: '', city: '', isDefault: false };

export default function Account() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: '/account' }} />;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo title="My Account" description="Manage your operator profile, addresses and password." />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10 space-y-2 md:mb-14">
          <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">// OPERATOR_PROFILE</p>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
            My <span className="text-primary not-italic">Account</span>
          </h1>
          <p className="font-medium text-slate-500">{user.email}</p>
        </div>

        <QuickLinks />

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="space-y-8 lg:col-span-3">
            <DetailsCard />
            <AddressesCard uid={user.uid} />
          </div>
          <div className="lg:col-span-2">
            <PasswordCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
      <h2 className="flex items-center gap-3 text-lg font-black tracking-tighter uppercase italic">
        <Icon size={18} className="text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="terminal-label text-slate-500">{label}</span>
      {textarea ? (
        <textarea
          rows={2}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="field-input resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="field-input"
        />
      )}
    </label>
  );
}

function QuickLinks() {
  const { signOut } = useAuth();
  const links = [
    { to: '/orders', icon: Package, label: 'My Deployments' },
    { to: '/wishlist', icon: Heart, label: 'Watchlist' },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {links.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}

function DetailsCard() {
  const { profile, saveProfile } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState(() => ({
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    city: profile?.city ?? '',
    address: profile?.address ?? '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2) return setError('Enter your name.');
    if (form.phone && !PHONE_PATTERN.test(form.phone.replace(/[\s-]/g, ''))) {
      return setError('Enter a valid mobile number, e.g. 03164587553.');
    }
    setBusy(true);
    try {
      await saveProfile({
        name: form.name.trim(),
        email: profile?.email ?? '',
        phone: form.phone.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
      });
      notify('Profile saved.');
    } catch (caught) {
      console.error('Profile save failed:', caught);
      setError('Could not save your details. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={User} title="Details">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
          <Field label="Mobile" type="tel" value={form.phone} onChange={set('phone')} placeholder="03164587553" autoComplete="tel" />
          <Field label="City" value={form.city} onChange={set('city')} autoComplete="address-level2" />
        </div>
        <Field label="Address" value={form.address} onChange={set('address')} autoComplete="street-address" textarea />
        {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
        <button type="submit" disabled={busy} className="primary-btn px-6 py-2.5 text-sm">
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </Card>
  );
}

function AddressesCard({ uid }: { uid: string }) {
  const { notify } = useToast();
  const { data: addresses, loading, reload } = useAsync(() => fetchAddresses(uid), `addresses-${uid}`);
  const [editing, setEditing] = useState<{ id: string | null; form: AddressInput } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const list = addresses ?? [];

  const startEdit = (address: SavedAddress | null) => {
    setError('');
    setEditing(
      address
        ? { id: address.id, form: { ...address } }
        : { id: null, form: { ...EMPTY_ADDRESS, isDefault: list.length === 0 } },
    );
  };

  const update = (key: keyof AddressInput) => (value: string) =>
    setEditing((current) => (current ? { ...current, form: { ...current.form, [key]: value } } : current));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const { form } = editing;
    if (!form.label.trim()) return setError('Give it a label, e.g. Home or Office.');
    if (form.fullName.trim().length < 3) return setError('Enter the recipient’s full name.');
    if (!PHONE_PATTERN.test(form.phone.replace(/[\s-]/g, ''))) return setError('Enter a valid mobile number.');
    if (form.address.trim().length < 10) return setError('Enter the full address.');
    if (form.city.trim().length < 2) return setError('Enter the city.');

    setBusy(true);
    try {
      await saveAddress(uid, editing.id, form, list);
      notify(editing.id ? 'Address updated.' : 'Address saved.');
      setEditing(null);
      reload();
    } catch (caught) {
      console.error('Address save failed:', caught);
      setError('Could not save the address. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address: SavedAddress) => {
    if (!window.confirm(`Delete "${address.label}"?`)) return;
    setBusy(true);
    try {
      await deleteAddress(uid, address.id);
      notify('Address deleted.', 'info');
      reload();
    } catch {
      notify('Could not delete the address.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (address: SavedAddress) => {
    setBusy(true);
    try {
      await saveAddress(uid, address.id, { ...address, isDefault: true }, list);
      reload();
    } catch {
      notify('Could not update the default address.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={MapPin} title="Saved addresses">
      {loading ? (
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      ) : list.length === 0 && !editing ? (
        <p className="text-sm text-slate-500">No saved addresses yet. Saved addresses fill in automatically at checkout.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((address) => (
            <li
              key={address.id}
              className={cn(
                'flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4',
                address.isDefault ? 'border-primary/30 bg-primary/5' : 'border-slate-200',
              )}
            >
              <div className="min-w-0 space-y-0.5 text-sm">
                <p className="font-black text-slate-900">
                  {address.label}
                  {address.isDefault && (
                    <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-black text-white uppercase">Default</span>
                  )}
                </p>
                <p className="text-slate-600">{address.fullName} · {address.phone}</p>
                <p className="text-slate-500">{address.address}, {address.city}</p>
              </div>
              <div className="flex gap-1">
                {!address.isDefault && (
                  <button type="button" disabled={busy} onClick={() => void makeDefault(address)} title="Make default" aria-label="Make default" className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary">
                    <Star size={16} />
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => startEdit(address)} title="Edit" aria-label="Edit address" className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary">
                  <Pencil size={16} />
                </button>
                <button type="button" disabled={busy} onClick={() => void remove(address)} title="Delete" aria-label="Delete address" className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Label" value={editing.form.label} onChange={update('label')} placeholder="Home, Office…" />
            <Field label="Recipient name" value={editing.form.fullName} onChange={update('fullName')} autoComplete="name" />
            <Field label="Mobile" type="tel" value={editing.form.phone} onChange={update('phone')} placeholder="03164587553" autoComplete="tel" />
            <Field label="City" value={editing.form.city} onChange={update('city')} autoComplete="address-level2" />
          </div>
          <Field label="Address" value={editing.form.address} onChange={update('address')} autoComplete="street-address" textarea />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={editing.form.isDefault}
              onChange={(event) =>
                setEditing((current) => (current ? { ...current, form: { ...current.form, isDefault: event.target.checked } } : current))
              }
              className="h-4 w-4 accent-primary"
            />
            Use as default at checkout
          </label>
          {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="primary-btn px-5 py-2.5 text-sm">
              {busy ? 'Saving…' : 'Save address'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="secondary-btn px-5 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        list.length < MAX_ADDRESSES && (
          <button
            type="button"
            onClick={() => startEdit(null)}
            className="flex cursor-pointer items-center gap-2 text-sm font-black tracking-wide text-primary"
          >
            <Plus size={16} /> Add address
          </button>
        )
      )}
    </Card>
  );
}

function PasswordCard() {
  const { changePassword } = useAuth();
  const { notify } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('The new password must be different.');

    setBusy(true);
    setError('');
    try {
      await changePassword(current, next);
      notify('Password changed.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'Your current password is incorrect.'
          : authErrorMessage(caught),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={KeyRound} title="Change password">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Field label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" />
        <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
        <button type="submit" disabled={busy || !current || !next} className="tech-btn w-full py-3 text-sm">
          {busy ? 'Updating…' : 'Update password'}
        </button>
        <p className="text-xs text-slate-400">
          Forgot it? Sign out and use “Forgot password” on the login page.
        </p>
      </form>
    </Card>
  );
}
