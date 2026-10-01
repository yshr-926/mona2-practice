import { describe, expect, it } from 'bun:test';
import { detectLayout, restoreLayoutPreference, selectedLayout, storeLayoutPreference, type LayoutStorage } from './os-layout.ts';
import { JIS_LAYOUT, US_LAYOUT } from './keycodes.ts';

function memoryStorage(): LayoutStorage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe('OS 配列の設定', () => {
  it('getLayoutMap から JIS / US を判定する', async () => {
    for (const [char, expected] of [['@', 'jis'], ['[', 'us'], ['ü', undefined]] as const) {
      expect(await detectLayout({ getLayoutMap: async () => new Map([['BracketLeft', char]]) })).toBe(expected);
    }
  });
  it('API 未対応・権限拒否・空の結果でも手動設定を使える', async () => {
    expect(await detectLayout()).toBeUndefined();
    expect(await detectLayout({ getLayoutMap: async () => { throw new Error('拒否'); } })).toBeUndefined();
    expect(await detectLayout({ getLayoutMap: async () => new Map() })).toBeUndefined();
    expect(selectedLayout('auto')).toBe(US_LAYOUT);
    expect(selectedLayout('jis')).toBe(JIS_LAYOUT);
  });
  it('手動設定は自動判定より優先する', () => {
    expect(selectedLayout('us', 'jis')).toBe(US_LAYOUT);
    expect(selectedLayout('jis', 'us')).toBe(JIS_LAYOUT);
    expect(selectedLayout('auto', 'jis')).toBe(JIS_LAYOUT);
    expect(selectedLayout('auto', 'us')).toBe(US_LAYOUT);
  });
  it('選択を保存・復元し、自動に戻せる', () => {
    const storage = memoryStorage();
    expect(restoreLayoutPreference(storage)).toBe('auto');
    for (const value of ['jis', 'us', 'auto'] as const) {
      expect(storeLayoutPreference(value, storage)).toBe(true);
      expect(restoreLayoutPreference(storage)).toBe(value);
    }
  });
  it('壊れた保存値・保存禁止でも正常にフォールバックする', () => {
    expect(restoreLayoutPreference({ getItem: () => 'invalid', setItem: () => {} })).toBe('auto');
    const blocked = { getItem: () => { throw new Error('拒否'); }, setItem: () => { throw new Error('拒否'); } };
    expect(restoreLayoutPreference(blocked)).toBe('auto');
    expect(storeLayoutPreference('jis', blocked)).toBe(false);
  });
});
