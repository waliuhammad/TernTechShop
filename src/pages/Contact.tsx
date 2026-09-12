import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { useState } from 'react';
import { Seo } from '@/components/ui/Seo';
import { TerminalPage } from '@/components/ui/TerminalPage';
import { contactSubjects, siteConfig } from '@/config/site';
import { useAuth } from '@/context/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { sendContactMessage } from '@/services/inbox';

const CHANNELS = [
  { icon: Mail, label: 'Secure Channel', value: siteConfig.contact.email, href: `mailto:${siteConfig.contact.email}` },
  {
    icon: Phone,
    label: 'Emergency Uplink',
    value: siteConfig.contact.phoneFormatted,
    href: `tel:+92${siteConfig.contact.phoneFormatted.replace(/\D/g, '').slice(1)}`,
  },
  { icon: MapPin, label: 'Physical Core', value: siteConfig.contact.addressCompact },
];

export default function Contact() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  // Honeypot: invisible to people, often filled in by spam bots.
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState<string>(contactSubjects[0]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  /** Saved to Firestore and shown to staff in Admin → Inbox. */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (website) {
      // A bot filled the hidden field — pretend success, store nothing.
      setSent(true);
      return;
    }

    if (name.trim().length < 2) {
      setError('Enter your identity name.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Add a little more detail to your transmission.');
      return;
    }

    if (!isFirebaseConfigured) {
      setError(`Messaging is unavailable right now — email us at ${siteConfig.contact.email}.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await sendContactMessage({ name, email, subject, message, userId: user?.uid });
      setSent(true);
      setMessage('');
    } catch (caught) {
      console.error('Contact message failed:', caught);
      setError(`Could not send your message. Please try again, or email ${siteConfig.contact.email}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Seo
        title="Contact Engineer"
        description="Direct access to our hardware engineering team for specialized implementation support and bulk manifest inquiries."
      />

      <TerminalPage
        badge="ENGINEER_ON_CALL"
        title="Contact Engineer"
        intro="Direct access to our hardware engineering team for specialized implementation support and bulk manifest inquiries."
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8">
            {CHANNELS.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-blue-400">
                  <Icon size={20} />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="terminal-label">{label}</div>
                  {href ? (
                    <a
                      href={href}
                      className="block text-base break-words text-slate-100 transition-colors hover:text-blue-400 md:text-lg"
                    >
                      {value}
                    </a>
                  ) : (
                    <div className="text-sm leading-relaxed text-slate-300">{value}</div>
                  )}
                </div>
              </div>
            ))}

            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="font-bold">Operating Window</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Monday to Saturday, 10:00 – 19:00 PKT. Bulk deployment queries receive a response
                within one business day.
              </p>
            </div>
          </div>

          {sent ? (
            <div className="space-y-4 self-start rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8">
              <Send size={30} className="text-emerald-400" />
              <h2 className="text-xl font-bold">Transmission Complete</h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Your message has reached our engineering desk. Our engineers will audit your
                manifest and respond shortly.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="cursor-pointer text-xs font-black tracking-widest text-blue-400 uppercase"
              >
                Send Another
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8"
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="contact-name" className="terminal-label">
                    Identity Name
                  </label>
                  <input
                    id="contact-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="terminal-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-email" className="terminal-label">
                    Communication Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="terminal-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-subject" className="terminal-label">
                  Manifest Subject
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="terminal-input cursor-pointer"
                >
                  {contactSubjects.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-message" className="terminal-label">
                  The Transmission
                </label>
                <textarea
                  id="contact-message"
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Enter your message details..."
                  className="terminal-input resize-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm font-bold text-rose-400">
                  {error}
                </p>
              )}

              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-bold text-white shadow-xl shadow-blue-900/30 transition-all hover:bg-blue-500"
              >
                <Send size={18} />
                {busy ? 'TRANSMITTING…' : 'TRANSMIT MANIFEST'}
              </button>
            </form>
          )}
        </div>
      </TerminalPage>
    </>
  );
}
