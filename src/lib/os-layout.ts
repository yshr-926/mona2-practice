// OS の配列を自動判定し、手動設定を優先する。
import { JIS_LAYOUT, US_LAYOUT, type KeyboardLayout } from './keycodes.ts';

export type LayoutName = 'us' | 'jis';
export type LayoutPreference = 'auto' | LayoutName;
export type LayoutStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type KeyboardLayoutAPI = { getLayoutMap: () => Promise<Pick<Map<string, string>, 'get'>> };
const STORAGE_KEY = 'mona2-practice:os-layout:v1';

function defaultStorage(): LayoutStorage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function restoreLayoutPreference(storage = defaultStorage()): LayoutPreference {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return value === 'us' || value === 'jis' ? value : 'auto';
  } catch { return 'auto'; }
}

export function storeLayoutPreference(value: LayoutPreference, storage = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, value);
    return true;
  } catch { return false; }
}

export async function detectLayout(keyboard?: KeyboardLayoutAPI): Promise<LayoutName | undefined> {
  try {
    const map = await keyboard?.getLayoutMap();
    if (map?.get('BracketLeft') === '@') return 'jis';
    if (map?.get('BracketLeft') === '[') return 'us';
  } catch { /* 権限拒否や未対応のときは手動設定を使う */ }
  return undefined;
}

export function selectedLayout(preference: LayoutPreference, detected?: LayoutName): KeyboardLayout {
  return (preference === 'auto' ? detected : preference) === 'jis' ? JIS_LAYOUT : US_LAYOUT;
}

let preference = restoreLayoutPreference();
let detected: LayoutName | undefined;
export function currentLayoutPreference(): LayoutPreference { return preference; }
export function detectedLayout(): LayoutName | undefined { return detected; }
export function currentLayout(): KeyboardLayout { return selectedLayout(preference, detected); }
export function setLayoutPreference(value: LayoutPreference): boolean {
  preference = value;
  return storeLayoutPreference(value);
}
export async function initializeLayout(): Promise<void> {
  const keyboard = (globalThis.navigator as Navigator & { keyboard?: KeyboardLayoutAPI } | undefined)?.keyboard;
  detected = await detectLayout(keyboard);
}
