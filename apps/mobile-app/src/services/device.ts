import * as Crypto from 'expo-crypto';
import { storage } from './storage';

let cachedDeviceId: string | null = null;

/**
 * Returns a stable, persistent hardware identifier for this install.
 * Used as the billing `hardwareId` that is bound to an authorized session.
 * The id is generated locally on first use and stored in the secure store.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const existing = await storage.getItem('dravio_device_id');
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }

  const id = Crypto.randomUUID();
  await storage.setItem('dravio_device_id', id);
  cachedDeviceId = id;
  return id;
}