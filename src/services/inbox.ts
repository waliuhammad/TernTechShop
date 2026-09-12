import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';
import { toIso } from '@/services/orders';

/**
 * Contact messages and warranty registrations.
 *
 * Both are written by visitors (signed in or not) and are readable only by
 * staff. Warranty registrations are keyed by serial number, so the same
 * serial cannot be registered twice.
 */

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string | undefined;
}

export async function sendContactMessage(input: ContactInput): Promise<void> {
  await setDoc(doc(collection(getDbOrThrow(), 'contactMessages')), {
    name: input.name.trim(),
    email: input.email.trim(),
    subject: input.subject,
    message: input.message.trim(),
    status: 'NEW',
    ...(input.userId ? { userId: input.userId } : {}),
    createdAt: serverTimestamp(),
  });
}

export interface ContactMessageDoc {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'NEW' | 'HANDLED';
  createdAt: string;
}

export async function fetchContactMessages(max = 300): Promise<ContactMessageDoc[]> {
  const snapshot = await getDocs(
    query(collection(getDbOrThrow(), 'contactMessages'), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snapshot.docs.map((snap) => {
    const data = snap.data();
    return {
      id: snap.id,
      name: String(data.name ?? ''),
      email: String(data.email ?? ''),
      subject: String(data.subject ?? ''),
      message: String(data.message ?? ''),
      status: data.status === 'HANDLED' ? 'HANDLED' : 'NEW',
      createdAt: toIso(data.createdAt),
    };
  });
}

export async function setMessageHandled(id: string, handled: boolean, staffUid: string): Promise<void> {
  await updateDoc(doc(getDbOrThrow(), 'contactMessages', id), {
    status: handled ? 'HANDLED' : 'NEW',
    handledBy: staffUid,
    handledAt: serverTimestamp(),
  });
}

export async function deleteContactMessage(id: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'contactMessages', id));
}

// ---------------------------------------------------------------------------
// Warranty
// ---------------------------------------------------------------------------

/** Serial numbers are stored upper-case, letters/digits/dashes only. */
export function normaliseSerial(serial: string): string {
  return serial.trim().toUpperCase().replace(/\s+/g, '');
}

export const SERIAL_PATTERN = /^[A-Z0-9-]{4,64}$/;

export class SerialAlreadyRegisteredError extends Error {
  constructor(serial: string) {
    super(`Serial number ${serial} is already registered. If this is a mistake, contact our team.`);
    this.name = 'SerialAlreadyRegisteredError';
  }
}

export interface WarrantyInput {
  serial: string;
  manifestId: string;
  email: string;
  productName: string;
  userId?: string | undefined;
}

export async function registerWarranty(input: WarrantyInput): Promise<void> {
  const serial = normaliseSerial(input.serial);
  try {
    await setDoc(doc(getDbOrThrow(), 'warranties', serial), {
      serialNumber: serial,
      manifestId: input.manifestId.trim().toUpperCase(),
      email: input.email.trim(),
      productName: input.productName.trim().slice(0, 200),
      ...(input.userId ? { userId: input.userId } : {}),
      status: 'PENDING',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Inputs are validated before this call, so a refusal here means the
    // serial's document already exists (a second registration is an update,
    // which only staff may make).
    if ((error as { code?: string })?.code === 'permission-denied') {
      throw new SerialAlreadyRegisteredError(serial);
    }
    throw error;
  }
}

export type WarrantyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WarrantyDoc {
  serial: string;
  manifestId: string;
  email: string;
  productName: string;
  status: WarrantyStatus;
  note: string;
  createdAt: string;
}

export async function fetchWarranties(max = 300): Promise<WarrantyDoc[]> {
  const snapshot = await getDocs(
    query(collection(getDbOrThrow(), 'warranties'), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snapshot.docs.map((snap) => {
    const data = snap.data();
    return {
      serial: snap.id,
      manifestId: String(data.manifestId ?? ''),
      email: String(data.email ?? ''),
      productName: String(data.productName ?? ''),
      status: (data.status as WarrantyStatus) ?? 'PENDING',
      note: String(data.note ?? ''),
      createdAt: toIso(data.createdAt),
    };
  });
}

export async function decideWarranty(
  serial: string,
  status: WarrantyStatus,
  note: string,
  staffUid: string,
): Promise<void> {
  await updateDoc(doc(getDbOrThrow(), 'warranties', serial), {
    status,
    note: note.trim().slice(0, 500),
    reviewedBy: staffUid,
    reviewedAt: serverTimestamp(),
  });
}

export async function deleteWarranty(serial: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'warranties', serial));
}
