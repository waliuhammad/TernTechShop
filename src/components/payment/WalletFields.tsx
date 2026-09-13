import { normaliseWalletNumber, WALLET_LABELS, type WalletProvider } from '@/services/payments';
import { cn } from '@/lib/utils';

export interface WalletDetails {
  mobileNumber: string;
  cnicLast6: string;
}

export interface WalletErrors {
  mobileNumber?: string;
  cnicLast6?: string;
}

export function validateWallet(provider: WalletProvider, details: WalletDetails): WalletErrors {
  const errors: WalletErrors = {};
  if (!normaliseWalletNumber(details.mobileNumber)) {
    errors.mobileNumber = `Enter the mobile number of your ${WALLET_LABELS[provider]} account, e.g. 03001234567.`;
  }
  if (provider === 'JAZZCASH' && !/^\d{6}$/.test(details.cnicLast6.trim())) {
    errors.cnicLast6 = 'Enter the last 6 digits of the CNIC registered with your JazzCash account.';
  }
  return errors;
}

/** Wallet number (and, for JazzCash, CNIC digits) for a mobile-wallet payment. */
export function WalletFields({
  provider,
  value,
  errors,
  onChange,
  idPrefix = 'wallet',
}: {
  provider: WalletProvider;
  value: WalletDetails;
  errors: WalletErrors;
  onChange: (next: WalletDetails) => void;
  idPrefix?: string;
}) {
  const label = WALLET_LABELS[provider];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-mobile`} className="terminal-label text-slate-500">
          {label} mobile number
        </label>
        <input
          id={`${idPrefix}-mobile`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value.mobileNumber}
          onChange={(event) => onChange({ ...value, mobileNumber: event.target.value })}
          placeholder="03001234567"
          className={cn('field-input font-mono', errors.mobileNumber && 'border-rose-400')}
        />
        {errors.mobileNumber && <p className="text-xs font-bold text-rose-500">{errors.mobileNumber}</p>}
      </div>

      {provider === 'JAZZCASH' && (
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-cnic`} className="terminal-label text-slate-500">
            Last 6 digits of CNIC
          </label>
          <input
            id={`${idPrefix}-cnic`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={value.cnicLast6}
            onChange={(event) => onChange({ ...value, cnicLast6: event.target.value.replace(/\D/g, '') })}
            placeholder="123456"
            className={cn('field-input font-mono', errors.cnicLast6 && 'border-rose-400')}
          />
          {errors.cnicLast6 ? (
            <p className="text-xs font-bold text-rose-500">{errors.cnicLast6}</p>
          ) : (
            <p className="text-xs text-slate-400">Required by JazzCash to verify the account. We never store it.</p>
          )}
        </div>
      )}
    </div>
  );
}
