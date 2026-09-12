import { ArrowLeft, ArrowRight, Banknote, Check, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { useAuth, type UserProfile } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useSettings } from '@/context/SettingsContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchAddresses } from '@/services/addresses';
import { evaluateCoupon, fetchCoupon } from '@/lib/coupons';
import { formatPrice } from '@/lib/money';
import { cn } from '@/lib/utils';
import { MAX_ORDER_LINES, OrderRejectedError, placeOrder } from '@/services/orders';
import type { Coupon, ShippingDetails } from '@/types';

const STEPS = ['Shipping', 'Payment', 'Review'] as const;

const CITIES = [
  'Islamabad',
  'Rawalpindi',
  'Lahore',
  'Karachi',
  'Peshawar',
  'Faisalabad',
  'Multan',
  'Quetta',
  'Other',
];

type FieldErrors = Partial<Record<keyof ShippingDetails, string>>;

function validateShipping(details: ShippingDetails): FieldErrors {
  const errors: FieldErrors = {};

  if (details.fullName.trim().length < 3) errors.fullName = 'Enter the full consignee name.';
  if (!/^\S+@\S+\.\S+$/.test(details.email.trim())) errors.email = 'Enter a valid email address.';
  // Pakistani mobile numbers: 10-11 digits, optionally with a country code.
  if (!/^(\+92|0)?3\d{9}$/.test(details.phone.replace(/[\s-]/g, '')))
    errors.phone = 'Enter a valid mobile number, e.g. 03164587553.';
  if (details.address.trim().length < 10) errors.address = 'Enter the full deployment address.';
  if (!details.city) errors.city = 'Select a deployment city.';

  return errors;
}

export default function Checkout() {
  const { syncing } = useCart();
  const { user, profile, suspended, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading || syncing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  // Orders carry a verified userId — the security rules reject anything else.
  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-16">
        <Seo title="Authorization Required" />
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">
            Authentication <span className="text-primary not-italic">Required</span>
          </h1>
          <p className="leading-relaxed font-medium text-slate-500">
            Deployments are authorized against a verified operator identity. Sign in to finalize
            this manifest — your cart travels with you.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/checkout' } })}
            className="primary-btn w-full py-4"
          >
            Initialize Session
          </button>
        </div>
      </div>
    );
  }

  // Mirrors the rules, which would refuse the order anyway — this just says why.
  if (suspended) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-16">
        <Seo title="Account Suspended" />
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">
            Account <span className="text-rose-600 not-italic">Suspended</span>
          </h1>
          <p className="leading-relaxed font-medium text-slate-500">
            This account can't place orders right now. If you think this is a mistake, contact our
            team and quote the email you signed in with.
          </p>
          <button type="button" onClick={() => navigate('/contact')} className="primary-btn w-full py-4">
            Contact Engineer
          </button>
        </div>
      </div>
    );
  }

  // Mounted only once auth has resolved, so the form can seed itself from the
  // saved profile on its first render instead of patching state afterwards.
  // Keyed by uid so switching accounts starts a clean form.
  return <CheckoutFlow key={user.uid} userId={user.uid} profile={profile} />;
}

interface CheckoutFlowProps {
  userId: string;
  profile: UserProfile | null;
}

function CheckoutFlow({ userId, profile }: CheckoutFlowProps) {
  const { lines, getTotals, clear } = useCart();
  const { saveProfile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const couponCode = (location.state as { couponCode?: string } | null)?.couponCode;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');

  const [details, setDetails] = useState<ShippingDetails>(() => ({
    fullName: profile?.name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    notes: '',
  }));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.lineTotal, 0), [lines]);

  // Re-fetched here rather than trusted from the cart page; the rules check it
  // again server-side regardless. `undefined` = still loading, `null` = none.
  const [coupon, setCoupon] = useState<Coupon | null | undefined>(couponCode ? undefined : null);

  useEffect(() => {
    if (!couponCode) return undefined;
    let active = true;
    void fetchCoupon(couponCode).then((result) => {
      if (active) setCoupon(result);
    });
    return () => {
      active = false;
    };
  }, [couponCode]);

  const couponLoading = coupon === undefined;

  const discount = useMemo(() => {
    if (!coupon) return 0;
    const result = evaluateCoupon(coupon, subtotal);
    return result.status === 'valid' ? result.discount : 0;
  }, [coupon, subtotal]);

  const totals = getTotals(discount);

  const { logistics } = useSettings();
  const savedAddresses = useAsync(() => fetchAddresses(userId), `checkout-addresses-${userId}`);

  // Zones are editable in Admin -> Settings; match the city against each
  // sector's name, falling back to the last (catch-all) zone.
  const zone = useMemo(() => {
    const zones = logistics.zones;
    if (!details.city || zones.length === 0) return undefined;
    const city = details.city.toLowerCase();
    return zones.find((candidate) => candidate.sector.toLowerCase().includes(city)) ?? zones[zones.length - 1];
  }, [details.city, logistics.zones]);

  const applyAddress = (id: string) => {
    const picked = savedAddresses.data?.find((address) => address.id === id);
    if (!picked) return;
    setDetails((current) => ({
      ...current,
      fullName: picked.fullName,
      phone: picked.phone,
      address: picked.address,
      city: CITIES.includes(picked.city) ? picked.city : 'Other',
    }));
    setErrors({});
  };

  if (lines.length === 0 && !placed) return <Navigate to="/cart" replace />;

  const update = (field: keyof ShippingDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const goToPayment = () => {
    const found = validateShipping(details);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notify('Check the highlighted fields before continuing.', 'error');
      return;
    }
    // Remember the consignee for next time.
    void saveProfile({
      name: details.fullName,
      email: details.email,
      phone: details.phone,
      city: details.city,
      address: details.address,
    }).catch(() => {
      // A failed profile save must not block the purchase.
    });
    setStep(1);
  };

  const submitOrder = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const manifestId = await placeOrder({
        userId,
        lines,
        totals,
        shipping: details,
        ...(couponCode && discount > 0 ? { couponCode } : {}),
      });

      setPlaced(true);
      // Only empty the cart once the order has actually been accepted by the
      // security rules — a rejected write must leave the manifest intact.
      await clear();
      navigate(`/order-confirmation/${manifestId}`, { replace: true });
    } catch (error) {
      const message =
        error instanceof OrderRejectedError
          ? error.message
          : 'Could not authorize the deployment. Please try again.';
      setSubmitError(message);
      notify(message, 'error');
      setSubmitting(false);
    }
  };

  const overLineLimit = lines.length > MAX_ORDER_LINES;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo title="Checkout" description="Authorize your hardware deployment." />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10 space-y-2 md:mb-16">
          <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
            // DEPLOYMENT_AUTHORIZATION
          </p>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
            Finalize <span className="text-primary not-italic">Deployment</span>
          </h1>
        </div>

        {overLineLimit && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm leading-relaxed font-bold text-amber-900">
              A manifest can carry at most {MAX_ORDER_LINES} distinct components. Remove{' '}
              {lines.length - MAX_ORDER_LINES} from your{' '}
              <Link to="/cart" className="underline">
                cart
              </Link>
              , or{' '}
              <Link to="/contact" className="underline">
                contact an engineer
              </Link>{' '}
              for a bulk deployment.
            </p>
          </div>
        )}

        {/* Stepper */}
        <ol className="mb-10 flex items-center gap-2 md:mb-16 md:gap-4">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-3">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black transition-colors md:h-10 md:w-10',
                    index < step
                      ? 'bg-emerald-500 text-white'
                      : index === step
                        ? 'bg-primary text-white'
                        : 'bg-slate-200 text-slate-500',
                  )}
                >
                  {index < step ? <Check size={16} /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-[10px] font-black tracking-widest uppercase sm:inline md:text-xs',
                    index === step ? 'text-slate-900' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <span
                  className={cn(
                    'h-0.5 flex-grow rounded-full transition-colors',
                    index < step ? 'bg-emerald-500' : 'bg-slate-200',
                  )}
                />
              )}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          <div className="space-y-6 lg:col-span-2">
            {/* Step 1 — Shipping */}
            {step === 0 && (
              <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-10">
                <div>
                  <h2 className="text-xl font-black tracking-tighter uppercase italic">
                    Deployment Destination
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Tell us where the hardware should land.
                  </p>
                </div>

                {(savedAddresses.data?.length ?? 0) > 0 && (
                  <label className="block space-y-2">
                    <span className="terminal-label text-slate-500">Use a saved address</span>
                    <select
                      defaultValue=""
                      onChange={(event) => applyAddress(event.target.value)}
                      className="field-input cursor-pointer"
                    >
                      <option value="" disabled>
                        Choose…
                      </option>
                      {savedAddresses.data?.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} — {address.address}, {address.city}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label="Full Consignee Name"
                    id="fullName"
                    value={details.fullName}
                    onChange={(value) => update('fullName', value)}
                    error={errors.fullName}
                    autoComplete="name"
                  />
                  <Field
                    label="Transmission Email"
                    id="email"
                    type="email"
                    value={details.email}
                    onChange={(value) => update('email', value)}
                    error={errors.email}
                    autoComplete="email"
                  />
                  <Field
                    label="Logistics Contact"
                    id="phone"
                    type="tel"
                    value={details.phone}
                    onChange={(value) => update('phone', value)}
                    error={errors.phone}
                    placeholder="03164587553"
                    autoComplete="tel"
                  />

                  <div className="space-y-2">
                    <label htmlFor="city" className="terminal-label text-slate-500">
                      Deployment City
                    </label>
                    <select
                      id="city"
                      value={details.city}
                      onChange={(event) => update('city', event.target.value)}
                      className={cn('field-input cursor-pointer', errors.city && 'border-rose-400')}
                    >
                      <option value="">Select city…</option>
                      {CITIES.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    {errors.city && <p className="text-xs font-bold text-rose-500">{errors.city}</p>}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="address" className="terminal-label text-slate-500">
                      Deployment Address
                    </label>
                    <textarea
                      id="address"
                      rows={3}
                      value={details.address}
                      onChange={(event) => update('address', event.target.value)}
                      placeholder="Full warehouse or office location..."
                      autoComplete="street-address"
                      className={cn('field-input resize-none', errors.address && 'border-rose-400')}
                    />
                    {errors.address && (
                      <p className="text-xs font-bold text-rose-500">{errors.address}</p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="notes" className="terminal-label text-slate-500">
                      Deployment Instructions (optional)
                    </label>
                    <textarea
                      id="notes"
                      rows={2}
                      value={details.notes}
                      onChange={(event) => update('notes', event.target.value)}
                      placeholder="Landmark, floor, preferred delivery window…"
                      className="field-input resize-none"
                    />
                  </div>
                </div>

                {details.city && zone && (
                  <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs font-medium text-primary">
                    {zone.sector} — estimated arrival {zone.deliveryWindow} via {zone.carrier}.
                  </p>
                )}

                <button
                  type="button"
                  onClick={goToPayment}
                  disabled={overLineLimit}
                  className="primary-btn w-full py-4"
                >
                  Continue to Funding Protocol
                </button>
              </section>
            )}

            {/* Step 2 — Payment */}
            {step === 1 && (
              <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-10">
                <div>
                  <h2 className="text-xl font-black tracking-tighter uppercase italic">
                    Funding Protocol
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Fuel the procurement with your preferred method.
                  </p>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                    <Banknote size={22} />
                  </span>
                  <div className="space-y-1">
                    <p className="font-black text-slate-900">Cash on Delivery</p>
                    <p className="text-sm font-medium text-slate-500">
                      Pay when your hardware assets arrive at your destination.
                    </p>
                  </div>
                  <Check size={20} className="ml-auto shrink-0 text-primary" />
                </div>

                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed font-medium text-slate-500">
                  Card and bank transfer are handled directly by our team — select Cash on Delivery
                  here and mention your preference when we confirm the manifest.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="secondary-btn flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="primary-btn flex flex-grow items-center justify-center gap-2 py-4"
                  >
                    Final Scan &amp; Review
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* Step 3 — Review */}
            {step === 2 && (
              <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-10">
                <h2 className="text-xl font-black tracking-tighter uppercase italic">
                  Final Scan &amp; Review
                </h2>

                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <h3 className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                    Consignee
                  </h3>
                  <div className="space-y-1 text-sm font-medium text-slate-700">
                    <p className="font-black text-slate-900">{details.fullName}</p>
                    <p>{details.phone}</p>
                    <p>{details.email}</p>
                    <p>{details.address}</p>
                    <p>{details.city}</p>
                    {details.notes && <p className="text-slate-500 italic">{details.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="cursor-pointer text-[10px] font-black tracking-widest text-primary uppercase"
                  >
                    Edit Destination
                  </button>
                </div>

                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {lines.map((line) => (
                    <li key={line.product.id} className="flex items-center gap-4 p-4">
                      <img
                        src={line.product.images[0]}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1"
                      />
                      <div className="min-w-0 flex-grow">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {line.product.name}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 uppercase">
                          x{line.quantity} // {line.product.sku}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black">{formatPrice(line.lineTotal)}</p>
                    </li>
                  ))}
                </ul>

                {submitError && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600"
                  >
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    {submitError}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="secondary-btn flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitOrder}
                    disabled={submitting || overLineLimit || couponLoading}
                    className="primary-btn flex flex-grow items-center justify-center gap-3 py-4 text-base"
                  >
                    {submitting ? 'Finalizing…' : 'Authorize Deployment'}
                    {!submitting && <ArrowRight size={18} />}
                  </button>
                </div>

                <p className="flex items-center justify-center gap-2 text-center text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  <ShieldCheck size={14} />
                  Pricing re-verified server-side on authorization
                </p>
              </section>
            )}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
              <h2 className="border-l-4 border-primary pl-4 text-lg font-black tracking-tighter uppercase italic">
                Manifest Summary
              </h2>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="font-medium text-slate-500">
                    Subtotal ({lines.length} {lines.length === 1 ? 'line' : 'lines'})
                  </dt>
                  <dd className="font-bold">{formatPrice(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <dt className="font-medium">Discount {couponCode && `(${couponCode})`}</dt>
                    <dd className="font-bold">-{formatPrice(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="font-medium text-slate-500">Logistics</dt>
                  <dd className="font-bold">
                    {totals.shipping === 0 ? (
                      <span className="text-emerald-600">Free</span>
                    ) : (
                      formatPrice(totals.shipping)
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex items-end justify-between border-t border-slate-100 pt-5">
                <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                  Total Valuation
                </span>
                <span className="text-2xl font-black tracking-tighter md:text-3xl">
                  {formatPrice(totals.total)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}

function Field({
  label,
  id,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  autoComplete,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="terminal-label text-slate-500">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className={cn('field-input', error && 'border-rose-400')}
      />
      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
    </div>
  );
}
