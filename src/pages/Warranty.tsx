import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Seo } from '@/components/ui/Seo';
import { TerminalPage } from '@/components/ui/TerminalPage';
import { siteConfig } from '@/config/site';
import { useAuth } from '@/context/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  normaliseSerial,
  registerWarranty,
  SerialAlreadyRegisteredError,
  SERIAL_PATTERN,
} from '@/services/inbox';
import { warrantyBenefits } from '@/data/site-data';
import { resolveIcon } from '@/lib/icons';

export default function Warranty() {
  const { user, profile } = useAuth();
  const [serial, setSerial] = useState('');
  const [manifestId, setManifestId] = useState('');
  const [productName, setProductName] = useState('');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  /** Saved to Firestore; staff approve or reject it in Admin → Inbox. */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!SERIAL_PATTERN.test(normaliseSerial(serial))) {
      setError('Enter the serial number printed on the unit (letters, digits and dashes, 4–64 characters).');
      return;
    }
    if (manifestId.trim().length < 4) {
      setError('Enter the Manifest ID from your receipt.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    if (!isFirebaseConfigured) {
      setError(`Registration is unavailable right now — email us at ${siteConfig.contact.email}.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await registerWarranty({ serial, manifestId, email, productName, userId: user?.uid });
      setSubmitted(true);
    } catch (caught) {
      if (caught instanceof SerialAlreadyRegisteredError) {
        setError(caught.message);
      } else {
        console.error('Warranty registration failed:', caught);
        setError(`Could not register right now. Please try again, or email ${siteConfig.contact.email}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Seo
        title="Warranty Registry"
        description="Extended protection and authentication for your Tern hardware assets."
      />

      <TerminalPage
        badge="WARRANTY_REGISTRY_V1.1"
        title="Warranty Registry"
        intro="Extended protection and authentication for your Tern hardware assets."
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {submitted ? (
            <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <h2 className="text-xl font-bold">Registry Transmitted</h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Your registration has been received. Our engineers
                will confirm the digital signature shortly.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="cursor-pointer text-xs font-black tracking-widest text-blue-400 uppercase"
              >
                Register Another Unit
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8"
            >
              <h2 className="text-xl font-bold">Register Your Hardware</h2>

              <div className="space-y-2">
                <label htmlFor="serial" className="terminal-label">
                  Serial Number (S/N)
                </label>
                <input
                  id="serial"
                  value={serial}
                  onChange={(event) => setSerial(event.target.value)}
                  placeholder="TT-XXXXXXXX"
                  className="terminal-input font-mono"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="manifest" className="terminal-label">
                  Purchase Manifest ID
                </label>
                <input
                  id="manifest"
                  value={manifestId}
                  onChange={(event) => setManifestId(event.target.value)}
                  placeholder="Found on your receipt"
                  className="terminal-input font-mono"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="warranty-product" className="terminal-label">
                  Product (optional)
                </label>
                <input
                  id="warranty-product"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder="e.g. RTX 4080 SUPER"
                  className="terminal-input"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="warranty-email" className="terminal-label">
                  Communication Email
                </label>
                <input
                  id="warranty-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="terminal-input"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm font-bold text-rose-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full cursor-pointer rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500"
              >
                {busy ? 'AUTHENTICATING…' : 'AUTHENTICATE & REGISTER'}
              </button>
            </form>
          )}

          <div className="space-y-6">
            {warrantyBenefits.map((benefit) => {
              const Icon = resolveIcon(benefit.iconKey);
              return (
                <div
                  key={benefit.title}
                  className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-blue-400" />
                    <h3 className="font-bold">{benefit.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-500">{benefit.description}</p>
                </div>
              );
            })}

            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="font-bold">Coverage Window</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Standard coverage runs 12 months from the deployment date, with a 30-day RMA window
                for dead-on-arrival units. Enterprise manifests may carry extended terms.
              </p>
            </div>
          </div>
        </div>
      </TerminalPage>
    </>
  );
}
