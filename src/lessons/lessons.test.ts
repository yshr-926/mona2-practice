import { describe, expect, it } from 'bun:test';
import data from '../data/keyboard.json';
import type { KeyboardData } from '../lib/zmk.ts';
import { createKeymap, expectedCodes, tapKeycode } from '../lib/layout.ts';
import { SYSTEM_SHORTCUTS, keycodeToCode } from '../lib/keycodes.ts';
import { buildLessons, keyPositions } from './index.ts';

const kb = data as KeyboardData;
const km = createKeymap(kb);

describe('lessons against the synced keymap', () => {
  it('finds every key the lessons refer to (update lessons/index.ts if this fails after a keymap change)', () => {
    const missing = Object.entries(keyPositions(km)).filter(([, v]) =>
      v === undefined ? true : typeof v === 'number' ? v < 0 : Array.isArray(v) ? v.length === 0 || v.some((x) => x === -1) : false,
    );
    expect(missing.map(([k]) => k)).toEqual([]);
  });

  it('only asks to type characters that the keymap can produce', () => {
    const lines = buildLessons(km).flatMap((l) => ('lines' in l.task ? (l.task.lines as string[]) : []));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.flatMap((l) => [...l]).filter((c) => !km.charMap.has(c))).toEqual([]);
  });

  it('has unique lesson ids', () => {
    const ids = buildLessons(km).map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can verify every base-layer key in the key test (by keydown, or by the screen change for Mac system shortcuts)', () => {
    const untestable = kb.layers[0].bindings.flatMap((b, pos) => (expectedCodes(b).length || SYSTEM_SHORTCUTS[tapKeycode(b) ?? ''] ? [] : [pos]));
    expect(untestable).toEqual([]);
  });
});

describe('keycodeToCode', () => {
  it('maps ZMK names to KeyboardEvent.code', () => {
    expect(keycodeToCode('Q')).toBe('KeyQ');
    expect(keycodeToCode('NUMBER_7')).toBe('Digit7');
    expect(keycodeToCode('F13')).toBe('F13');
    expect(keycodeToCode('LANG2')).toBe('Lang2');
    expect(keycodeToCode('LEFT_WIN')).toBe('MetaLeft');
  });

  it('accepts either tap or hold output for mod-taps', () => {
    expect(expectedCodes({ behavior: 'mt', params: ['LEFT_SHIFT', 'Z'] })).toEqual(['KeyZ', 'ShiftLeft']);
  });
});
