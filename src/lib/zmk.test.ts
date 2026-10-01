import { describe, expect, it } from 'bun:test';
import { bindingLabel, createKeymap, expectedCodes, holdLayer, tapKeycode } from './layout.ts';
import { expandDefines, parseDefines, parseKeymap, type KeyboardData } from './zmk.ts';

// #define・自作 hold-tap (ホームロウ mod)・display-name つきマクロを含む小さなキーマップ
const src = `
#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

#define MOUSE 5
#define NAV MOUSE // 値の中の識別子も展開する
#define HM_TERM 200
#define CMD_C LG(C)
#define LONG_DEFINE \\
  7
#define FN(x) x

/ {
  macros {
    hello: hello {
      compatible = "zmk,behavior-macro";
      #binding-cells = <0>;
      display-name = "あいさつ";
      bindings = <&macro_tap &kp H &kp I>;
    };
    bye: bye_macro {
      compatible = "zmk,behavior-macro";
      #binding-cells = <0>;
      bindings = <&macro_tap &kp B>;
    };
    to_base: to_base {
      compatible = "zmk,behavior-macro-one-param";
      #binding-cells = <1>;
      bindings = <&to 0 &macro_param_1to1 &kp MACRO_PLACEHOLDER>;
    };
  };

  behaviors {
    hm: homerow_mods {
      compatible = "zmk,behavior-hold-tap";
      #binding-cells = <2>;
      tapping-term-ms = <HM_TERM>;
      bindings = <&kp>, <&kp>;
    };
    lt_base: lt_base {
      compatible = "zmk,behavior-hold-tap";
      #binding-cells = <2>;
      bindings = <&mo>, <&to_base>;
    };
    ht_hello: ht_hello {
      compatible = "zmk,behavior-hold-tap";
      #binding-cells = <2>;
      bindings = <&mo>, <&hello>;
    };
  };

  combos {
    compatible = "zmk,combos";
    c { bindings = <&mo MOUSE>; key-positions = <0 LONG_DEFINE>; };
  };

  keymap {
    compatible = "zmk,keymap";
    base {
      bindings = <&hm LSHIFT A &hm LGUI S &mo MOUSE &lt_base NAV LANG2 &hello &bye &kp CMD_C &ht_hello 1 0>;
    };
    MOUSE {
      bindings = <&kp B &trans &trans &trans &trans &trans &trans &trans>;
    };
  };
};
`;

const { layers, combos } = parseKeymap(src);
const base = layers[0].bindings;

describe('#define', () => {
  it('collects object-like defines only, joining line continuations', () => {
    const defines = parseDefines(src);
    expect(defines.get('MOUSE')).toBe('5');
    expect(defines.get('LONG_DEFINE')).toBe('7');
    expect(defines.has('FN')).toBe(false);
  });

  it('expands nested defines without looping on self references', () => {
    expect(expandDefines('&mo NAV', parseDefines(src))).toBe('&mo 5');
    expect(expandDefines('A B', new Map([['A', 'B'], ['B', 'A']]))).toBe('A B');
  });

  it('expands defines in bindings and key positions, but not in layer names', () => {
    expect(base[2]).toEqual({ behavior: 'mo', params: ['5'] });
    expect(holdLayer(base[2])).toBe(5);
    expect(base[6]).toEqual({ behavior: 'kp', params: ['LG(C)'] });
    expect(combos[0].positions).toEqual([0, 7]);
    expect(holdLayer(combos[0].binding)).toBe(5);
    expect(layers.map((l) => l.name)).toEqual(['base', 'MOUSE']);
  });

  it('keeps names from #include headers as keycodes', () => {
    expect(tapKeycode(base[0])).toBe('A');
  });
});

describe('custom behaviors', () => {
  it('resolves a home row mod hold-tap like &mt', () => {
    expect(tapKeycode(base[0])).toBe('A');
    expect(holdLayer(base[0])).toBeUndefined();
    expect(bindingLabel(base[0]).hold).toBe(bindingLabel({ behavior: 'mt', params: ['LSHIFT', 'A'] }).hold);
    expect(expectedCodes(base[0])).toEqual(expectedCodes({ behavior: 'mt', params: ['LSHIFT', 'A'] }));
  });

  it('resolves a hold-tap whose tap side is a macro forwarding its param to &kp', () => {
    expect(tapKeycode(base[3])).toBe('LANG2');
    expect(holdLayer(base[3])).toBe(5);
    expect(bindingLabel(base[3]).hold).toBe('L5');
  });

  it('labels a hold-tap whose tap side is a plain macro with the macro name', () => {
    expect(tapKeycode(base[7])).toBeUndefined();
    expect(bindingLabel(base[7])).toEqual({ tap: 'あいさつ', hold: 'L1' });
  });

  it('labels macros with display-name, or the node name', () => {
    expect(bindingLabel(base[4])).toEqual({ tap: 'あいさつ' });
    expect(bindingLabel(base[5])).toEqual({ tap: 'bye_macro' });
    expect(tapKeycode(base[4])).toBeUndefined();
  });

  it('uses home row mods as Shift for typing capitals', () => {
    const bindings = base.slice(0, 2); // &hm LSHIFT A &hm LGUI S
    const kb: KeyboardData = {
      source: '',
      syncedAt: '',
      keys: bindings.map((_, i) => ({ x: i, y: 0, w: 1, h: 1 })),
      layers: [{ name: 'base', bindings }],
      combos: [],
    };
    const km = createKeymap(kb);
    expect(km.charMap.get('a')).toMatchObject({ layer: 0, key: 0 });
    expect(km.charMap.get('S')).toMatchObject({ key: 1, shiftKey: 0 });
  });
});
