import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { logistics as defaultLogistics, shippingZones as defaultZones } from '@/data/site-data';
import { getDbOrThrow, isFirebaseConfigured } from '@/lib/firebase';
import type { ShippingZone } from '@/types';

/**
 * Shipping settings (settings/logistics).
 *
 * The fee and threshold here are the SAME values firestore.rules reads when it
 * checks an order's shipping, so the cart's preview and the server's check can
 * never disagree. Zones are display-only (the /shipping page table).
 */
export interface LogisticsSettings {
  /** Paisa. */
  standardShippingFee: number;
  /** Paisa. Orders at or above this subtotal (after discount) ship free. */
  freeShippingThreshold: number;
  zones: ShippingZone[];
}

export const DEFAULT_LOGISTICS: LogisticsSettings = {
  standardShippingFee: defaultLogistics.standardFee,
  freeShippingThreshold: defaultLogistics.freeThreshold,
  zones: defaultZones,
};

function toZones(value: unknown): ShippingZone[] {
  if (!Array.isArray(value)) return defaultZones;
  return value
    .map((zone) => ({
      sector: String((zone as ShippingZone)?.sector ?? ''),
      deliveryWindow: String((zone as ShippingZone)?.deliveryWindow ?? ''),
      carrier: String((zone as ShippingZone)?.carrier ?? ''),
    }))
    .filter((zone) => zone.sector);
}

export async function fetchLogistics(): Promise<LogisticsSettings> {
  if (!isFirebaseConfigured) return DEFAULT_LOGISTICS;
  try {
    const snap = await getDoc(doc(getDbOrThrow(), 'settings', 'logistics'));
    if (!snap.exists()) return DEFAULT_LOGISTICS;
    const data = snap.data();
    return {
      standardShippingFee: Number(data.standardShippingFee ?? DEFAULT_LOGISTICS.standardShippingFee),
      freeShippingThreshold: Number(data.freeShippingThreshold ?? DEFAULT_LOGISTICS.freeShippingThreshold),
      zones: 'zones' in data ? toZones(data.zones) : defaultZones,
    };
  } catch (error) {
    console.error('Logistics settings load failed, using defaults:', error);
    return DEFAULT_LOGISTICS;
  }
}

export async function saveLogistics(settings: LogisticsSettings): Promise<void> {
  await setDoc(
    doc(getDbOrThrow(), 'settings', 'logistics'),
    {
      standardShippingFee: settings.standardShippingFee,
      freeShippingThreshold: settings.freeShippingThreshold,
      zones: settings.zones.slice(0, 12),
      currency: 'PKR',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
