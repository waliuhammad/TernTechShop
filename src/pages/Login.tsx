import { CheckCircle2, Lock, Mail, TriangleAlert, User } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { authErrorMessage, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'register' | 'reset';

const MIN_PASSWORD_LENGTH = 8;

export default function Login() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Where to land after signing in — checkout sends people here mid-purchase.
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/account';

  if (!loading && user) return <Navigate to={redirectTo} replace />;

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <Seo title="Login Hub" />
        <div className="max-w-md space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <TriangleAlert className="mx-auto text-amber-500" size={32} />
          <h1 className="text-xl font-black text-amber-900">Authentication not configured</h1>
          <p className="text-sm leading-relaxed text-amber-800">
            Copy <code className="font-mono">.env.example</code> to{' '}
            <code className="font-mono">.env</code> and add your Firebase project keys, then
            restart the dev server. See <span className="font-mono">docs/FIREBASE-SETUP.md</span>.
          </p>
        </div>
      </div>
    );
  }

  const validate = (): string | null => {
    if (mode === 'register' && name.trim().length < 3) return 'Enter your full identity name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
    if (mode !== 'reset' && password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError('');

    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
        return;
      }

      if (mode === 'register') {
        await signUp(email, password, name);
        notify('Session initialized. Welcome to the registry.');
      } else {
        await signIn(email, password);
        notify('Session initialized.');
      }

      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setResetSent(false);
    setPassword('');
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-4 py-16 sm:px-6">
      <Seo
        title={mode === 'register' ? 'New Registration' : 'Login Hub'}
        description="Your professional hardware hub awaits."
      />

      <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-10">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
            <Lock size={24} />
          </div>
          <h1 className="text-3xl leading-tight font-black text-slate-900 md:text-4xl">
            {mode === 'register' ? (
              <>
                Join <span className="text-primary italic">TernTech</span>
              </>
            ) : mode === 'reset' ? (
              <>
                Recover <span className="text-primary italic">Access</span>
              </>
            ) : (
              <>
                Enter <span className="text-primary italic">TernTech</span>
              </>
            )}
          </h1>
          <p className="text-base font-medium tracking-tight text-slate-500 md:text-lg">
            {mode === 'register'
              ? 'Your hardware infrastructure begins with your first authorization.'
              : mode === 'reset'
                ? 'We will transmit a reset link to your registered email.'
                : 'Your professional hardware hub awaits.'}
          </p>
        </div>

        {resetSent ? (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" size={28} />
            <p className="text-sm leading-relaxed font-bold text-emerald-900">
              Reset link transmitted to {email}. Check your inbox, and your spam folder.
            </p>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="cursor-pointer text-[10px] font-black tracking-widest text-emerald-800 uppercase"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <Field
                icon={User}
                id="name"
                label="Identity Name"
                value={name}
                onChange={setName}
                autoComplete="name"
              />
            )}

            <Field
              icon={Mail}
              id="email"
              label="Communication Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />

            {mode !== 'reset' && (
              <Field
                icon={Lock}
                id="password"
                label="Security Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            )}

            {mode === 'register' && (
              <p className="px-2 text-xs font-medium text-slate-400">
                Minimum {MIN_PASSWORD_LENGTH} characters. Your password is hashed and stored by
                Firebase Authentication — it never touches this site's code.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600"
              >
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full cursor-pointer rounded-2xl bg-primary py-4 text-lg font-black text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? 'Processing…'
                : mode === 'register'
                  ? 'Register'
                  : mode === 'reset'
                    ? 'Transmit Reset Link'
                    : 'Login Now'}
            </button>
          </form>
        )}

        {!resetSent && (
          <div className="space-y-3 text-center">
            <button
              type="button"
              onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}
              className="cursor-pointer text-sm font-bold text-slate-500 transition-colors hover:text-primary"
            >
              {mode === 'register'
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="block w-full cursor-pointer text-[10px] font-black tracking-widest text-slate-400 uppercase transition-colors hover:text-primary"
              >
                Forgot Password?
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  icon: typeof User;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}

function Field({ icon: Icon, id, label, value, onChange, type = 'text', autoComplete }: FieldProps) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon
        size={18}
        className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-slate-400"
      />
      <input
        id={id}
        type={type}
        value={value}
        placeholder={label}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full rounded-2xl border-2 border-transparent bg-slate-50 px-14 py-4 font-bold text-slate-900 transition-all outline-none',
          'focus:border-primary',
        )}
      />
    </div>
  );
}
