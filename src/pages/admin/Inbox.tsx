import { Check, Mail, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { AdminError, AdminPageHeader, AdminSpinner, StatusBadge } from '@/components/admin/AdminUI';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { cn, formatDateTime } from '@/lib/utils';
import {
  decideWarranty,
  deleteContactMessage,
  deleteWarranty,
  fetchContactMessages,
  fetchWarranties,
  setMessageHandled,
  type ContactMessageDoc,
  type WarrantyDoc,
} from '@/services/inbox';

type Tab = 'messages' | 'warranties';

export default function AdminInbox() {
  const [tab, setTab] = useState<Tab>('messages');
  const messages = useAsync(() => fetchContactMessages(), 'admin-messages');
  const warranties = useAsync(() => fetchWarranties(), 'admin-warranties');

  const newMessages = (messages.data ?? []).filter((message) => message.status === 'NEW').length;
  const pendingWarranties = (warranties.data ?? []).filter((warranty) => warranty.status === 'PENDING').length;

  return (
    <div>
      <AdminPageHeader eyebrow="// INCOMING_TRANSMISSIONS" title="Engineer" accent="Inbox" />

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { key: 'messages', label: 'Contact messages', count: newMessages },
            { key: 'warranties', label: 'Warranty registrations', count: pendingWarranties },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-colors',
              tab === key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400',
            )}
          >
            {label}
            {count > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'messages' ? (
        <Messages state={messages} />
      ) : (
        <Warranties state={warranties} />
      )}
    </div>
  );
}

interface AsyncList<T> {
  data: T[] | undefined;
  error: string;
  loading: boolean;
  reload: () => void;
}

function Messages({ state }: { state: AsyncList<ContactMessageDoc> }) {
  const { user, isAdmin } = useAuth();
  const { notify } = useToast();
  const [showHandled, setShowHandled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = state.data ?? [];
  const visible = all.filter((message) => (showHandled ? true : message.status === 'NEW'));

  const act = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id);
    try {
      await action();
      notify(success);
      state.reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (state.loading) return <AdminSpinner />;

  return (
    <div>
      <AdminError message={state.error} />
      <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm font-bold text-slate-600">
        <input
          type="checkbox"
          checked={showHandled}
          onChange={(event) => setShowHandled(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Show handled messages
      </label>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          {all.length ? 'No new messages — all handled.' : 'No messages yet.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((message) => {
            const busy = busyId === message.id;
            const handled = message.status === 'HANDLED';
            return (
              <li
                key={message.id}
                className={cn('space-y-3 rounded-2xl border bg-white p-6', handled ? 'border-slate-200 opacity-70' : 'border-primary/20')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{message.subject}</p>
                    <p className="text-sm text-slate-600">
                      {message.name} ·{' '}
                      <a href={`mailto:${message.email}`} className="text-primary hover:underline">
                        {message.email}
                      </a>
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(message.createdAt)}</p>
                  </div>
                  {handled && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-700 uppercase">
                      Handled
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{message.message}</p>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <a
                    href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
                  >
                    <Mail size={14} /> Reply by email
                  </a>
                  <button
                    type="button"
                    disabled={busy || !user}
                    onClick={() =>
                      user &&
                      void act(
                        message.id,
                        () => setMessageHandled(message.id, !handled, user.uid),
                        handled ? 'Moved back to new.' : 'Marked as handled.',
                      )
                    }
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {handled ? <RotateCcw size={14} /> : <Check size={14} />}
                    {handled ? 'Mark as new' : 'Mark handled'}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm('Delete this message permanently?')) return;
                        void act(message.id, () => deleteContactMessage(message.id), 'Message deleted.');
                      }}
                      className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Warranties({ state }: { state: AsyncList<WarrantyDoc> }) {
  const { user, isAdmin } = useAuth();
  const { notify } = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busySerial, setBusySerial] = useState<string | null>(null);

  const all = state.data ?? [];

  const decide = async (warranty: WarrantyDoc, status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    if (!user) return;
    setBusySerial(warranty.serial);
    try {
      await decideWarranty(warranty.serial, status, notes[warranty.serial] ?? warranty.note, user.uid);
      notify(`${warranty.serial} ${status === 'PENDING' ? 'reopened' : status.toLowerCase()}.`);
      state.reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusySerial(null);
    }
  };

  const remove = async (warranty: WarrantyDoc) => {
    if (!window.confirm(`Delete the registration for ${warranty.serial}? The serial can then be registered again.`)) return;
    setBusySerial(warranty.serial);
    try {
      await deleteWarranty(warranty.serial);
      notify('Registration deleted.');
      state.reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusySerial(null);
    }
  };

  if (state.loading) return <AdminSpinner />;

  return (
    <div>
      <AdminError message={state.error} />
      {all.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          No warranty registrations yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {all.map((warranty) => {
            const busy = busySerial === warranty.serial;
            return (
              <li key={warranty.serial} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-lg font-black text-primary">{warranty.serial}</p>
                    <p className="text-sm text-slate-600">
                      {warranty.productName || 'Product not given'} · Manifest{' '}
                      <span className="font-mono font-bold">{warranty.manifestId}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      <a href={`mailto:${warranty.email}`} className="text-primary hover:underline">
                        {warranty.email}
                      </a>{' '}
                      · {formatDateTime(warranty.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={warranty.status} />
                </div>

                <p className="text-xs text-slate-400">
                  Check the manifest ID in <strong>Orders</strong> before approving.
                </p>

                <input
                  value={notes[warranty.serial] ?? warranty.note}
                  maxLength={500}
                  onChange={(event) => setNotes((current) => ({ ...current, [warranty.serial]: event.target.value }))}
                  placeholder="Internal note (optional)"
                  className="field-input text-sm"
                  aria-label={`Note for ${warranty.serial}`}
                />

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {warranty.status !== 'APPROVED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(warranty, 'APPROVED')}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                  )}
                  {warranty.status !== 'REJECTED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(warranty, 'REJECTED')}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  )}
                  {warranty.status !== 'PENDING' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(warranty, 'PENDING')}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw size={14} /> Reopen
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(warranty)}
                      className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
