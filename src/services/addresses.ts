import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';

/** A customer's saved delivery addresses (users/{uid}/addresses). */

export const MAX_ADDRESSES = 10;

export interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
}

export type AddressInput = Omit<SavedAddress, 'id'>;

const addressesRef = (uid: string) => collection(getDbOrThrow(), 'users', uid, 'addresses');

export async function fetchAddresses(uid: string): Promise<SavedAddress[]> {
  const snapshot = await getDocs(addressesRef(uid));
  return snapshot.docs
    .map((snap) => {
      const data = snap.data();
      return {
        id: snap.id,
        label: String(data.label ?? ''),
        fullName: String(data.fullName ?? ''),
        phone: String(data.phone ?? ''),
        address: String(data.address ?? ''),
        city: String(data.city ?? ''),
        isDefault: data.isDefault === true,
      };
    })
    // Default first, then alphabetical by label.
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label));
}

/**
 * Creates (id = null) or updates an address. Marking it default clears the
 * flag on every other address in the same batch, so exactly one stays default.
 */
export async function saveAddress(
  uid: string,
  id: string | null,
  input: AddressInput,
  existing: SavedAddress[],
): Promise<void> {
  const db = getDbOrThrow();
  const ref = id ? doc(addressesRef(uid), id) : doc(addressesRef(uid));
  const makeDefault = input.isDefault || existing.length === 0;

  const batch = writeBatch(db);
  batch.set(ref, {
    label: input.label.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    isDefault: makeDefault,
    updatedAt: serverTimestamp(),
  });
  if (makeDefault) {
    existing
      .filter((address) => address.id !== ref.id && address.isDefault)
      .forEach((address) =>
        batch.set(doc(addressesRef(uid), address.id), {
          label: address.label,
          fullName: address.fullName,
          phone: address.phone,
          address: address.address,
          city: address.city,
          isDefault: false,
          updatedAt: serverTimestamp(),
        }),
      );
  }
  await batch.commit();
}

export async function deleteAddress(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(addressesRef(uid), id));
}
