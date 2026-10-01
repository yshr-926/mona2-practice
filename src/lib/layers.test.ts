import { describe, expect, it } from 'bun:test';
import { describeStroke, strokeView } from '../ui/typing.ts';
import { createKeymap, holdKeys, shiftKey, type Stroke } from './layout.ts';
import { parseKeymap, type KeyboardData } from './zmk.ts';

// 小さな .keymap から、キーを横一列に並べた KeyboardData を作る (左半分が左手)
function keymapOf(body: string, extra = ''): KeyboardData {
  const { layers, combos, conditionalLayers } = parseKeymap(`/ { ${extra} keymap { compatible = "zmk,keymap"; ${body} }; };`);
  return {
    source: '',
    syncedAt: '',
    keys: layers[0].bindings.map((_, i) => ({ x: i, y: 0, w: 1, h: 1 })),
    layers,
    combos,
    ...(conditionalLayers.length ? { conditionalLayers } : {}),
  };
}

const layer = (name: string, bindings: string) => `${name} { bindings = <${bindings}>; };`;
const steps = (s: Stroke | undefined) => s?.steps.map((t) => ({ keys: t.keys, press: t.press, role: t.role }));

describe('&tog / &to', () => {
  const km = createKeymap(
    keymapOf(layer('base', '&kp A &tog 1 &kp B &kp LSHIFT') + layer('num', '&kp N1 &trans &kp N2 &trans')),
  );

  it('トグルで入るレイヤーの文字は「押して切り替えてから」', () => {
    const s = km.charMap.get('1');
    expect(s).toMatchObject({ layer: 1, layers: [0, 1], key: 0 });
    expect(steps(s)).toEqual([{ keys: [1], press: 'toggle', role: 'layer' }]);
    expect(describeStroke(km, s!)).toBe('<b class="k-hold">L1切替</b> を押して切り替えてから + <b class="k-target">1</b>');
  });

  it('&to でも同じように入れる', () => {
    const to = createKeymap(keymapOf(layer('base', '&kp A &to 1') + layer('num', '&kp N1 &kp N2')));
    expect(steps(to.charMap.get('1'))).toEqual([{ keys: [1], press: 'toggle', role: 'layer' }]);
    expect(to.reachable).toEqual([0, 1]);
  });

  it('同じレイヤーにホールドでも入れるならホールドを選ぶ', () => {
    const both = createKeymap(keymapOf(layer('base', '&tog 1 &kp A &mo 1') + layer('num', '&trans &kp N1 &trans')));
    expect(steps(both.charMap.get('1'))).toEqual([{ keys: [2], press: 'hold', role: 'layer' }]);
  });
});

describe('&sl / &sk', () => {
  it('ワンショットのレイヤーは「押して離してから」。Shift はワンショットより先に押さえる', () => {
    const km = createKeymap(keymapOf(layer('base', '&kp LEFT_SHIFT &sl 1 &kp A &kp B') + layer('num', '&trans &trans &trans &kp N1')));
    expect(steps(km.charMap.get('1'))).toEqual([{ keys: [1], press: 'sticky', role: 'layer' }]);
    const bang = km.charMap.get('!');
    expect(steps(bang)).toEqual([
      { keys: [0], press: 'hold', role: 'shift' },
      { keys: [1], press: 'sticky', role: 'layer' },
    ]);
    expect(bang?.steps[0].layers).toEqual([0]);
    expect(describeStroke(km, bang!)).toBe(
      '<b class="k-shift">Shift</b> を押したまま + <b class="k-hold">L1(1回)</b> を押して離してから + <b class="k-target">1</b>',
    );
  });

  it('&sk LSHIFT で大文字を打てる。ホールドの Shift があればそちらを選ぶ', () => {
    const sk = createKeymap(keymapOf(layer('base', '&kp A &sk LSHIFT')));
    expect(steps(sk.charMap.get('A'))).toEqual([{ keys: [1], press: 'sticky', role: 'shift' }]);
    expect(sk.charMap.get('a')?.steps).toEqual([]);
    expect(shiftKey(sk.charMap.get('A')!)).toBeUndefined();

    const both = createKeymap(keymapOf(layer('base', '&kp A &sk LSHIFT &kp RSHIFT')));
    expect(shiftKey(both.charMap.get('A')!)).toBe(2);
  });
});

describe('ベース以外からの &mo (多段)', () => {
  const km = createKeymap(
    keymapOf(
      layer('base', '&mo 1 &kp A &kp B &kp C') + layer('one', '&trans &mo 2 &trans &kp N7') + layer('two', '&trans &trans &kp N2 &trans'),
    ),
  );

  it('L1 をホールドしてから、L1 のキーで L2 をホールドする', () => {
    const s = km.charMap.get('2');
    expect(s).toMatchObject({ layer: 2, layers: [0, 1, 2], key: 2 });
    expect(holdKeys(s!)).toEqual([0, 1]);
    expect(s?.steps.map((t) => t.layers)).toEqual([[0], [0, 1]]);
    expect(describeStroke(km, s!)).toBe(
      '<b class="k-hold">L1</b> を押したまま + <b class="k-hold">L2</b> を押したまま + <b class="k-target">2</b>',
    );
  });

  it('&trans は下の有効なレイヤーへ落ちる', () => {
    expect(km.resolve([0, 1, 2], 3)).toEqual({ behavior: 'kp', params: ['N7'] });
    expect(km.resolve([0, 2], 3)).toEqual({ behavior: 'kp', params: ['C'] });
  });

  it('キーボード図: 先に押したキーは押したときの表示、ほかは有効なレイヤーを重ねた表示', () => {
    const view = strokeView(km, km.charMap.get('2')!);
    expect(view).toMatchObject({ layer: 2, layers: [0, 1, 2] });
    expect([...view.marks!]).toEqual([
      [0, 'hold'],
      [1, 'hold'],
      [2, 'target'],
    ]);
    expect(view.pressedIn?.get(1)).toEqual([0, 1]);
  });
});

describe('自作 hold-tap のレイヤー', () => {
  it('behaviors で定義した hold-tap (ホールドが &mo) で入れる', () => {
    const behaviors = `behaviors { my_lt: my_lt { compatible = "zmk,behavior-hold-tap"; #binding-cells = <2>; bindings = <&mo>, <&kp>; }; };`;
    const km = createKeymap(keymapOf(layer('base', '&my_lt 1 SPACE &kp A') + layer('num', '&trans &kp N1'), behaviors));
    expect(km.charMap.get(' ')?.steps).toEqual([]);
    expect(holdKeys(km.charMap.get('1')!)).toEqual([0]);
  });

  it('sticky-key で定義したワンショットレイヤー', () => {
    const behaviors = `behaviors { osl: osl { compatible = "zmk,behavior-sticky-key"; #binding-cells = <1>; bindings = <&mo>; }; };`;
    const km = createKeymap(keymapOf(layer('base', '&osl 1 &kp A') + layer('num', '&trans &kp N1'), behaviors));
    expect(steps(km.charMap.get('1'))).toEqual([{ keys: [0], press: 'sticky', role: 'layer' }]);
  });
});

describe('トライレイヤー (conditional-layers)', () => {
  const tri = `conditional_layers { compatible = "zmk,conditional-layers"; tri { if-layers = <1 2>; then-layer = <3>; }; };`;
  const km = createKeymap(
    keymapOf(
      layer('base', '&mo 1 &mo 2 &kp A &kp B') +
        layer('lower', '&trans &trans &kp N1 &trans') +
        layer('raise', '&trans &trans &kp N2 &trans') +
        layer('adjust', '&trans &trans &kp N3 &trans'),
      tri,
    ),
  );

  it('2 つのレイヤーキーを押さえると 3 つ目のレイヤーになる', () => {
    const s = km.charMap.get('3');
    expect(s).toMatchObject({ layer: 3, layers: [0, 1, 2, 3], key: 2 });
    expect(holdKeys(s!)).toEqual([0, 1]);
    expect(km.reachable).toEqual([0, 1, 2, 3]);
  });
});

describe('コンボで入るレイヤー', () => {
  it('コンボをホールドして入るレイヤーの文字は「同時に押したまま」', () => {
    const combos = `combos { compatible = "zmk,combos"; fn { key-positions = <0 1>; bindings = <&mo 1>; }; };`;
    const km = createKeymap(keymapOf(layer('base', '&kp A &kp B &kp C') + layer('fn', '&trans &trans &kp N5'), combos));
    const s = km.charMap.get('5');
    expect(steps(s)).toEqual([{ keys: [0, 1], press: 'hold', role: 'layer' }]);
    expect(describeStroke(km, s!)).toBe(
      '<b class="k-hold">A</b> と <b class="k-hold">B</b> を同時に押したまま + <b class="k-target">5</b>',
    );
  });

  it('layers が決まっているコンボは、そのレイヤーでだけ使う', () => {
    const combos = `combos { compatible = "zmk,combos"; fn { key-positions = <1 2>; bindings = <&mo 2>; layers = <1>; }; };`;
    const km = createKeymap(
      keymapOf(layer('base', '&mo 1 &kp A &kp B &kp C') + layer('one', '&trans &trans &trans &trans') + layer('two', '&trans &trans &trans &kp N9'), combos),
    );
    const s = km.charMap.get('9');
    expect(steps(s)).toEqual([
      { keys: [0], press: 'hold', role: 'layer' },
      { keys: [1, 2], press: 'hold', role: 'layer' },
    ]);
  });
});
