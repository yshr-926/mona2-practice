// 他人のキーマップを読み込んだとき、レッスンが参照するキーが無くても画面が壊れないことを確かめる。

import { describe, expect, it } from 'bun:test';
import { bundledKeyboard } from '../lib/keymap-source.ts';
import { createKeymap } from '../lib/layout.ts';
import type { Binding, KeyboardData } from '../lib/zmk.ts';
import { DRILLS, pickLine, typableLines } from '../drills.ts';
import type { KeyboardView } from '../ui/keyboard.ts';
import { buildLessons } from './index.ts';

const bundled = bundledKeyboard();
const kp = (code: string): Binding => ({ behavior: 'kp', params: [code] });
const none: Binding = { behavior: 'none', params: [] };

// 標準のキーマップを少し壊したもの
function variant(edit: (kb: KeyboardData) => void): KeyboardData {
  const kb = structuredClone(bundled);
  edit(kb);
  return kb;
}

const VARIANTS: Record<string, KeyboardData> = {
  // Space のホールドが無い = 数字レイヤーに行けない
  'no number layer': variant((kb) => (kb.layers[0].bindings[40] = kp('SPACE'))),
  'no shift': variant((kb) => {
    kb.layers[0].bindings[21] = kp('Z');
    kb.layers[0].bindings[41] = none;
  }),
  // レイヤーキーが 1 つも無い (ベースだけ)
  'base layer only': variant((kb) => {
    kb.layers[0].bindings = kb.layers[0].bindings.map((b) => (b.params.length === 2 && /^\d+$/.test(b.params[0]) ? kp(b.params[1]) : b));
    kb.combos = [];
  }),
  'no combos': variant((kb) => (kb.combos = [])),
  // コンボの先が存在しないレイヤー
  'combo to a missing layer': variant((kb) => (kb.combos[0].binding = { behavior: 'lt', params: ['9', 'ESC'] })),
  // 左クリックのキーが無い
  'no left click': variant((kb) => {
    kb.layers.forEach((l) => (l.bindings = l.bindings.map((b) => (b.behavior === 'mkp' && b.params[0] === 'MB1' ? none : b))));
  }),
  // ベース以外が全部 &none
  'empty layers': variant((kb) => kb.layers.slice(1).forEach((l) => (l.bindings = l.bindings.map(() => none)))),
};
// ベースのキーを 1 つずつ消したもの
bundled.layers[0].bindings.forEach((_, pos) => {
  VARIANTS[`base key ${pos} removed`] = variant((kb) => (kb.layers[0].bindings[pos] = none));
});

// 課題・手順・本文が使う表示が、どれも存在するレイヤーを指しているか
function viewsOf(lesson: ReturnType<typeof buildLessons>[number]): KeyboardView[] {
  return [lesson.view].filter((v): v is KeyboardView => !!v);
}

describe('lessons with keys missing from the keymap', () => {
  for (const [name, kb] of Object.entries(VARIANTS)) {
    it(`builds every lesson without throwing (${name})`, () => {
      const km = createKeymap(kb);
      const lessons = buildLessons(km);
      expect(lessons.length).toBe(buildLessons(createKeymap(bundled)).length);
      for (const l of lessons) {
        for (const v of viewsOf(l)) {
          expect(kb.layers[v.layer]).toBeDefined();
          for (const pos of v.marks?.keys() ?? []) expect(kb.keys[pos]).toBeDefined();
        }
        // 見つからないキーを差し込んでも undefined などが出ない
        expect(`${l.title} ${l.body}`).not.toMatch(/undefined|NaN/);
        // 文字入力の課題は、打てる行が 1 つも無ければ飛ばす
        if (l.task.lines && !l.missing) expect(l.task.lines.some((line) => [...line].every((c) => km.charMap.has(c)))).toBe(true);
      }
    });
  }

  it('skips the lessons whose keys are missing, and says why', () => {
    const missing = (kb: KeyboardData) =>
      Object.fromEntries(
        buildLessons(createKeymap(kb))
          .filter((l) => l.missing)
          .map((l) => [l.id, l.missing]),
      );
    const noNumbers = missing(VARIANTS['no number layer']);
    expect(Object.keys(noNumbers)).toContain('numbers');
    expect(noNumbers.numbers).toContain('このキーマップでは打てません');

    const noClick = missing(VARIANTS['no left click']);
    expect(Object.keys(noClick)).toEqual(expect.arrayContaining(['click-left', 'drag']));
    expect(noClick['click-left']).toContain('このキーマップにはありません');
    expect(Object.keys(noClick)).not.toContain('click-right');

    // Space が消えても、Enter と BS の手順は残るので課題は飛ばさない
    expect(Object.keys(missing(VARIANTS['base key 40 removed']))).not.toContain('thumbs');
  });

  it('shows a marker instead of the key name when a layer key is missing', () => {
    const layers = buildLessons(createKeymap(VARIANTS['base layer only'])).find((l) => l.id === 'layers')!;
    expect(layers.body).toContain('(キーなし)');
    expect(layers.body).toContain('L?');
  });

  it('skips nothing with the synced keymap', () => {
    expect(buildLessons(createKeymap(bundled)).filter((l) => l.missing).map((l) => l.id)).toEqual([]);
  });
});

describe('free practice with keys missing from the keymap', () => {
  for (const [name, kb] of Object.entries(VARIANTS)) {
    it(`only picks lines the keymap can type (${name})`, () => {
      const km = createKeymap(kb);
      const canType = (c: string) => km.charMap.has(c);
      for (const drill of DRILLS) {
        const typable = typableLines(drill, canType);
        for (let i = 0; i < 20; i++) {
          const line = pickLine(drill, canType);
          if (!typable.length) expect(line).toBeUndefined();
          else expect([...line!].filter((c) => !canType(c))).toEqual([]);
        }
      }
    });
  }

  it('has no number lines to practice without the number layer', () => {
    const km = createKeymap(VARIANTS['no number layer']);
    const numbers = DRILLS.find((d) => d.id === 'numbers')!;
    expect(pickLine(numbers, (c) => km.charMap.has(c))).toBeUndefined();
  });
});
