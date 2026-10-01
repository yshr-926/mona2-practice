import { describe, expect, it } from 'bun:test';
import { bundledKeyboard } from '../lib/keymap-source.ts';
import { createKeymap, expectedCodes, tapKeycode } from '../lib/layout.ts';
import { SYSTEM_SHORTCUTS, keycodeToCode } from '../lib/keycodes.ts';
import { buildLessons, keyPositions } from './index.ts';

const kb = bundledKeyboard();
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

describe('キーマップから機能の教習を組み立てる', () => {
  it('標準には主要な機能が揃い、実際のキーから説明する', () => {
    const lessons = buildLessons(km);
    expect(lessons.map(l => l.id)).toEqual(expect.arrayContaining(['numbers', 'symbols', 'arrows', 'shift', 'combos', 'click-left', 'drag', 'scroll', 'bluetooth']));
    expect(lessons.find(l => l.id === 'numbers')!.body).toContain('Space を押したまま');
    expect(lessons.find(l => l.id === 'symbols')!.body).toContain('Enter を押したまま');
    expect(lessons.find(l => l.id === 'bluetooth')!.body).toContain('英数 + かな を同時に押したまま');
  });

  it('数字がトグル、Esc がベース、Shift がホームロウ mod、BT が無い構成', () => {
    const other = structuredClone(kb);
    other.layers[0].bindings[40] = { behavior: 'tog', params: ['1'] };
    other.layers[0].bindings[0] = { behavior: 'kp', params: ['ESC'] };
    other.layers[0].bindings[21] = { behavior: 'kp', params: ['Z'] };
    other.layers[0].bindings[41] = { behavior: 'none', params: [] };
    other.layers[0].bindings[13] = { behavior: 'mt', params: ['LEFT_SHIFT', 'D'] };
    other.combos = other.combos.filter(c => c.binding.params[0] !== '4');
    const lessons = buildLessons(createKeymap(other));
    expect(lessons.find(l => l.id === 'numbers')!.body).toContain('トグル');
    expect(lessons.find(l => l.id === 'combos')!.body).toContain('Esc を短く押す');
    expect(lessons.find(l => l.id === 'shift')!.body).toContain('短く押すと「D」、押したままだと Shift (mod-tap)');
    expect(lessons.map(l => l.id)).not.toContain('bluetooth');
    expect(lessons.find(l => l.id === 'layers')!.body).toContain('トグル');
  });

  it('ワンショットとコンボのレイヤー操作も本文と図に反映する', () => {
    const other = structuredClone(kb);
    other.layers[0].bindings[40] = { behavior: 'sl', params: ['1'] };
    const lessons = buildLessons(createKeymap(other));
    expect(lessons.find(l => l.id === 'numbers')!.body).toContain('ワンショット');
    const bt = lessons.find(l => l.id === 'bluetooth')!;
    expect(bt.view?.marks?.get(38)).toBe('hold');
    expect(bt.view?.marks?.get(39)).toBe('hold');
  });
});
