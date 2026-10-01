import { describe, expect, it } from 'bun:test';
import { bundledKeyboard } from './keymap-source.ts';
import { comboLayers, createKeymap } from './layout.ts';
import { parseBindings, parseKeymap, type KeyboardData } from './zmk.ts';

const kb = bundledKeyboard();
const km = createKeymap(kb);
const c = km.charMap;

describe('parseBindings', () => {
  it('splits behaviors and params, keeping modifier functions intact', () => {
    expect(parseBindings('&kp LC(LS(TAB))  &lt 2 ENTER &trans')).toEqual([
      { behavior: 'kp', params: ['LC(LS(TAB))'] },
      { behavior: 'lt', params: ['2', 'ENTER'] },
      { behavior: 'trans', params: [] },
    ]);
  });
});

describe('parseKeymap', () => {
  it('ignores comments, uses display-name, and reads combos', () => {
    const src = `/ {
      combos { compatible = "zmk,combos"; c { bindings = <&kp TAB>; key-positions = <1 2>; }; };
      keymap { compatible = "zmk,keymap"; base { display-name = "BASE"; bindings = <&kp A /* x */ &kp B>; // &kp C
      }; }; };`;
    const { layers, combos } = parseKeymap(src);
    expect(layers).toEqual([{ name: 'BASE', bindings: [{ behavior: 'kp', params: ['A'] }, { behavior: 'kp', params: ['B'] }] }]);
    expect(combos.map((co) => co.positions)).toEqual([[1, 2]]);
  });
});

describe('synced moNa2 keymap', () => {
  it('has the same number of bindings as physical keys on every layer', () => {
    for (const layer of kb.layers) expect(layer.bindings).toHaveLength(kb.keys.length);
  });

  it('enters layers 1-3 by holding thumb keys and layer 4 through the 英数+かな combo', () => {
    expect([...km.layerKeys.entries()].sort()).toEqual([
      [1, 40], // Space
      [2, 37], // Enter
      [3, 38], // 英数 (かな も同じレイヤー)
    ]);
    expect(comboLayers(kb)).toEqual([4]);
  });
});

describe('charMap', () => {
  it('types letters directly on the base layer', () => {
    expect(c.get('a')).toEqual({ char: 'a', layer: 0, key: 10, layerKey: undefined });
  });

  it('uses the Shift on the opposite hand', () => {
    expect(c.get('A')?.shiftKey).toBe(41); // A は左手 → 右下の Shift
    expect(c.get('J')?.shiftKey).toBe(21); // J は右手 → Z の Shift
  });

  it('prefers a direct symbol binding over Shift+number', () => {
    expect(c.get('!')).toMatchObject({ layer: 2, key: 0, layerKey: 37 });
    expect(c.get('!')?.shiftKey).toBeUndefined();
  });

  it('reaches numbers through the Space layer', () => {
    expect(c.get('1')).toMatchObject({ layer: 1, key: 0, layerKey: 40 });
  });

  it('falls back to layer + Shift when nothing else exists', () => {
    expect(c.get('{')).toMatchObject({ layer: 1, layerKey: 40 });
    expect(c.get('{')?.shiftKey).toBeDefined();
  });

  it('types capital Z with the right Shift', () => {
    expect(c.get('Z')).toMatchObject({ layer: 0, key: 21, shiftKey: 41 });
  });

  it('covers all printable ASCII', () => {
    const missing = [...Array(95)].map((_, i) => String.fromCharCode(32 + i)).filter((ch) => !c.has(ch));
    expect(missing).toEqual([]);
  });
});

describe('修飾つき文字の Stroke', () => {
  const fixture = (bindings: string): KeyboardData => ({
    ...kb,
    keys: kb.keys.slice(0, 4),
    layers: [{ name: 'BASE', bindings: parseBindings(bindings) }],
    combos: [],
  });

  it('&kp LS(N1) と &kp AT_SIGN は追加の Shift を必要としない', () => {
    const map = createKeymap(fixture('&kp LS(N1) &kp AT_SIGN &kp LEFT_SHIFT &kp LG(A)')).charMap;
    expect(map.get('!')).toEqual({ char: '!', layer: 0, key: 0, layerKey: undefined });
    expect(map.get('@')).toEqual({ char: '@', layer: 0, key: 1, layerKey: undefined });
    expect(map.has('1')).toBe(false);
    expect(map.has('2')).toBe(false);
    expect(map.has('a')).toBe(false);
  });

  it('配列表を差し替えると Stroke の文字も変わる', () => {
    const map = createKeymap(fixture('&kp AT_SIGN &kp N2 &kp RIGHT_SHIFT &kp INT3'), 0, {
      Digit2: ['2', '"'], IntlYen: ['¥', '|'],
    }).charMap;
    expect(map.get('"')?.key).toBe(0);
    expect(map.get('"')?.shiftKey).toBeUndefined();
    expect(map.get('2')?.key).toBe(1);
    expect(map.get('¥')?.key).toBe(3);
    expect(map.get('|')?.shiftKey).toBe(2);
    expect(map.has('@')).toBe(false);
  });
});
