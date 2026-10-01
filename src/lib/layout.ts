import { behaviorDef, type BehaviorDef, type Binding, type KeyboardData } from './zmk.ts';
import { US_LAYOUT, keycodeToChar, keycodeLabel, keycodeToCode, type KeyboardLayout } from './keycodes.ts';

// タップ時に送られるキーコード (&kp X / &mt MOD X / &lt N X / 自作 hold-tap など)
export function tapKeycode(b: Binding): string | undefined {
  const def = behaviorDef(b);
  if (def?.type === 'key') return b.params[0];
  if (def?.type === 'hold-tap' && def.tap.type === 'key') return b.params[1];
  return undefined;
}

// ホールドで有効になるレイヤー番号
export function holdLayer(b: Binding): number | undefined {
  const def = behaviorDef(b);
  if (def?.type === 'layer' || (def?.type === 'hold-tap' && def.hold.type === 'layer')) return Number(b.params[0]);
  return undefined;
}

// ホールドで送られるキーコード (&mt MOD X やホームロウ mod の MOD)
function holdKeycode(b: Binding): string | undefined {
  const def = behaviorDef(b);
  return def?.type === 'hold-tap' && def.hold.type === 'key' ? b.params[0] : undefined;
}

// ZMK 組み込みで、パラメータを取らないビヘイビアの表示名
const BUILTIN_LABELS: Record<string, string> = {
  studio_unlock: 'Unlock',
  bootloader: 'Boot',
  sys_reset: 'Reset',
  key_repeat: 'Repeat',
  caps_word: 'Caps',
};

// 正体ごとの表示 (hold-tap はホールド側・タップ側それぞれに使う)
function defLabel(def: BehaviorDef, param: string | undefined): string {
  switch (def.type) {
    case 'key':
      return keycodeLabel(param ?? '');
    case 'layer':
      return `L${param}`;
    case 'toggle-layer':
      return `L${param}切替`;
    case 'to-layer':
      return `L${param}へ`;
    case 'sticky-layer':
      return `L${param}(1回)`;
    case 'sticky-key':
      return `${keycodeLabel(param ?? '')}(1回)`;
    case 'hold-tap':
      return defLabel(def.tap, param);
    case 'other':
      return def.label;
  }
}

export function bindingLabel(b: Binding): { tap: string; hold?: string } {
  switch (b.behavior) {
    case 'trans':
      return { tap: '' };
    case 'none':
      return { tap: '✕' };
    case 'mkp':
      return { tap: { MB1: '左クリ', MB2: '右クリ', MB3: '中クリ' }[b.params[0]] ?? b.params[0] };
    case 'bt':
      return { tap: b.params[0] === 'BT_SEL' ? `BT ${b.params[1]}` : b.params[0] === 'BT_CLR' ? 'BT消去' : b.params[0] === 'BT_CLR_ALL' ? '全消去' : b.params.join(' ') };
    case 'out':
      return { tap: 'USB⇄BT' };
  }
  const def = behaviorDef(b);
  if (def?.type === 'hold-tap') return { tap: defLabel(def.tap, b.params[1]), hold: defLabel(def.hold, b.params[0]) };
  if (def) return { tap: defLabel(def, b.params[0]) };
  return { tap: BUILTIN_LABELS[b.behavior] ?? b.behavior };
}

// ---- キーマップ ----
// レイヤー 0 がベース。ほかのレイヤーには、レイヤーキーのホールド・トグル・ワンショット、
// コンボ、トライレイヤー (conditional-layers) などで入る。

export type Keymap = {
  kb: KeyboardData;
  base: number;
  layout: KeyboardLayout;
  // ベースで押しっぱなしにするとそのレイヤーになるキー
  layerKeys: Map<number, number>;
  // そのレイヤーの表示 (&trans はベースへ落ちる)
  effective: (layer: number, pos: number) => Binding;
  // 有効なレイヤーの組で、そのキーを押したときに働くビヘイビア (&trans は下の有効なレイヤーへ落ちる)
  resolve: (layers: number[], pos: number) => Binding;
  // 何らかの操作で入れるレイヤー (ベースを含む、番号順)
  reachable: number[];
  charMap: Map<string, Stroke>;
};

export function createKeymap(kb: KeyboardData, base = 0, layout: KeyboardLayout = US_LAYOUT): Keymap {
  // 同じレイヤーに入るキーが複数あるときは、親指の段 (下の方) で一番左のキーを代表にする
  const layerKeys = new Map<number, number>();
  kb.layers[base].bindings.forEach((b, pos) => {
    const l = holdLayer(b);
    if (l === undefined || l === base) return;
    const current = layerKeys.get(l);
    if (current === undefined || kb.keys[pos].y > kb.keys[current].y) layerKeys.set(l, pos);
  });
  const resolve = (layers: number[], pos: number) => {
    for (const l of [...layers].sort((a, b) => b - a)) {
      const b = kb.layers[l]?.bindings[pos];
      if (b && b.behavior !== 'trans') return b;
    }
    return kb.layers[base].bindings[pos];
  };
  const effective = (layer: number, pos: number) => resolve([base, layer], pos);
  const km: Keymap = { kb, base, layout, layerKeys, effective, resolve, reachable: [base], charMap: new Map() };
  const { charMap, reachable } = searchStrokes(km);
  km.charMap = charMap;
  km.reachable = reachable;
  return km;
}

// コンボを押しっぱなしにすると入るレイヤー (英数 + かな の L4 など)
export function comboLayers(kb: KeyboardData): number[] {
  return kb.combos.map((c) => holdLayer(c.binding)).filter((l): l is number => l !== undefined);
}

// 文字キーより先に行う操作 (Stroke.steps の順に行う)
export type StrokeStep = {
  keys: number[]; // 同時に押すキー (2 つ以上ならコンボ)
  layers: number[]; // 押すときに有効なレイヤー (キーの表示名はここから引く)
  // hold: 文字を打ち終わるまで押したまま / sticky: 押して離す (次のキー 1 回だけ効く) / toggle: 押して離す (切り替わったまま)
  press: 'hold' | 'sticky' | 'toggle';
  role: 'layer' | 'shift';
};

// ある文字を打つための操作。steps を順に行ってから key を押す
export type Stroke = {
  char: string;
  layer: number; // 文字キーを押すときに一番上にあるレイヤー (キーボード図に出す)
  layers: number[]; // 文字キーを押すときに有効なレイヤー (ベースを含む、番号順)
  key: number; // 文字キーの position
  steps: StrokeStep[];
};

// レイヤーに入るためにホールドするキー (コンボならその全部)
export const holdKeys = (s: Stroke): number[] => s.steps.filter((t) => t.role === 'layer' && t.press === 'hold').flatMap((t) => t.keys);
// Shift としてホールドするキー
export const shiftKey = (s: Stroke): number | undefined => s.steps.find((t) => t.role === 'shift' && t.press === 'hold')?.keys[0];

function isShift(b: Binding): boolean {
  return (
    /SHIFT|SHFT/.test(holdKeycode(b) ?? '') ||
    (behaviorDef(b)?.type === 'key' && /^(LEFT_SHIFT|LSHIFT|LSHFT|RIGHT_SHIFT|RSHIFT|RSHFT)$/.test(b.params[0]))
  );
}

// 押して離すとレイヤーや修飾が切り替わる操作 (&tog / &to / &sl / &sk。hold-tap のタップ側も含む)
type TapAction = { kind: 'tog' | 'to' | 'sl'; layer: number } | { kind: 'sk'; keycode: string };

function tapAction(b: Binding): TapAction | undefined {
  const def = behaviorDef(b);
  const [inner, param] = def?.type === 'hold-tap' ? [def.tap, b.params[1]] : [def, b.params[0]];
  if (param === undefined) return undefined;
  switch (inner?.type) {
    case 'toggle-layer':
      return { kind: 'tog', layer: Number(param) };
    case 'to-layer':
      return { kind: 'to', layer: Number(param) };
    case 'sticky-layer':
      return { kind: 'sl', layer: Number(param) };
    case 'sticky-key':
      return { kind: 'sk', keycode: param };
  }
  return undefined;
}

// 文字キーの前の操作は 3 つまで (それ以上は練習のヒントとして現実的でない)
const MAX_LAYER_STEPS = 3;

type SearchState = {
  on: number[]; // 自分で有効にしたレイヤー (ベースと conditional-layers は含めない)
  sticky?: number; // 次のキー 1 回だけ有効なレイヤー (&sl)
  stickyShift: boolean; // 次のキー 1 回だけ Shift がかかる (&sk)
  held: number[];
  steps: StrokeStep[];
  cost: number;
  // ホールドの Shift を入れる場所。&sl のあとに Shift を押すとワンショットが切れるので、&sl より前に押す
  shiftAt?: { layers: number[]; held: number[]; index: number };
};

function searchStrokes(km: Keymap): { charMap: Map<string, Stroke>; reachable: number[] } {
  const { kb, base } = km;
  const mid = (Math.min(...kb.keys.map((k) => k.x)) + Math.max(...kb.keys.map((k) => k.x))) / 2;
  const side = (pos: number) => kb.keys[pos].x < mid;
  const conditional = kb.conditionalLayers ?? [];

  // 有効なレイヤー: ベース + 自分で入れたもの + 条件を満たした conditional-layers (連鎖も見る)
  const activeLayers = (on: number[]): number[] => {
    const set = new Set([base, ...on]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const c of conditional) {
        if (!set.has(c.thenLayer) && c.ifLayers.length > 0 && c.ifLayers.every((l) => set.has(l))) {
          set.add(c.thenLayer);
          changed = true;
        }
      }
    }
    return [...set].filter((l) => kb.layers[l]).sort((a, b) => a - b);
  };
  const layersOf = (st: SearchState) => activeLayers(st.sticky === undefined ? st.on : [...st.on, st.sticky]);

  // 同時に押すキーが少ない順、同数ならホールド → ワンショット → トグルの順に簡単とみなす
  const PRESS_COST = { hold: 0, sticky: 0.5, toggle: 1 };

  // その状態から次に行える操作 (レイヤーキー・コンボ・ワンショット Shift)
  const nextStates = (st: SearchState): SearchState[] => {
    const layers = layersOf(st);
    const sources: { keys: number[]; binding: Binding }[] = [
      ...kb.keys.map((_, pos) => ({ keys: [pos], binding: km.resolve(layers, pos) })),
      ...kb.combos
        .filter((c) => c.binding && (!c.layers || c.layers.some((l) => layers.includes(l))))
        .map((c) => ({ keys: c.positions, binding: c.binding })),
    ];
    const out: { st: SearchState; y: number; pos: number }[] = [];
    for (const { keys, binding } of sources) {
      if (keys.some((k) => st.held.includes(k) || !kb.keys[k])) continue;
      const push = (press: StrokeStep['press'], role: StrokeStep['role'], next: Partial<SearchState>) =>
        out.push({
          st: {
            ...st,
            ...next,
            held: press === 'hold' ? [...st.held, ...keys] : st.held,
            steps: [...st.steps, { keys, layers, press, role }],
            cost: st.cost + keys.length + PRESS_COST[press],
          },
          y: -Math.max(...keys.map((k) => kb.keys[k].y)),
          pos: Math.min(...keys),
        });
      const hold = holdLayer(binding);
      if (hold !== undefined && !layers.includes(hold)) push('hold', 'layer', { on: [...st.on, hold] });
      const tap = tapAction(binding);
      if (!tap) continue;
      const shiftAt = { layers, held: st.held, index: st.steps.length };
      if (tap.kind === 'sk') {
        if (!st.stickyShift && isShift({ behavior: 'kp', params: [tap.keycode] })) push('sticky', 'shift', { stickyShift: true });
      } else if (!layers.includes(tap.layer) && kb.layers[tap.layer]) {
        if (tap.kind === 'tog') push('toggle', 'layer', { on: [...st.on, tap.layer] });
        else if (tap.kind === 'to') push('toggle', 'layer', { on: [tap.layer] });
        else push('sticky', 'layer', { sticky: tap.layer, shiftAt });
      }
    }
    // 同じ操作になるキーが複数あれば、親指の段 (下の方) で一番左のキーを先にする
    return out.sort((a, b) => a.st.cost - b.st.cost || a.y - b.y || a.pos - b.pos).map((o) => o.st);
  };

  const candidates: Stroke[] = [];
  const costs = new Map<Stroke, number>();
  const reachable = new Set<number>();
  const emit = (st: SearchState) => {
    const layers = layersOf(st);
    layers.forEach((l) => reachable.add(l));
    const top = layers[layers.length - 1];
    // 文字キーの好み: ベースに近いほど簡単。長押しで別の役割になるキー (lt / mt) より普通のキー
    const extra = (pos: number) =>
      (top === base ? 0 : 0.01 + top * 0.001) + (behaviorDef(km.resolve(layers, pos))?.type === 'key' ? 0 : 0.0001);
    const add = (s: Stroke, cost: number) => {
      candidates.push(s);
      costs.set(s, cost);
    };
    const shiftAt = st.shiftAt ?? { layers, held: st.held, index: st.steps.length };
    const stepKeys = st.steps.flatMap((t) => t.keys);
    const shiftKeys = kb.keys
      .map((_, pos) => pos)
      .filter((pos) => !shiftAt.held.includes(pos) && !stepKeys.includes(pos) && isShift(km.resolve(shiftAt.layers, pos)));

    for (let pos = 0; pos < kb.keys.length; pos++) {
      if (st.held.includes(pos)) continue;
      const code = tapKeycode(km.resolve(layers, pos));
      const char = code && keycodeToChar(code, km.layout);
      if (!char) continue;
      const stroke = (c: string, steps: StrokeStep[]): Stroke => ({ char: c, layer: top, layers, key: pos, steps });
      if (!st.stickyShift) add(stroke(char, st.steps), st.cost + extra(pos));
      const shifted = keycodeToChar(code!, km.layout, true);
      if (!shifted || shifted === char) continue;
      if (st.stickyShift) {
        add(stroke(shifted, st.steps), st.cost + extra(pos));
        continue;
      }
      // Shift は打つキーと反対の手を優先する (タイピングの基本)
      const shift = shiftKeys.filter((s) => s !== pos).sort((a, b) => Number(side(a) === side(pos)) - Number(side(b) === side(pos)))[0];
      if (shift === undefined) continue;
      const steps = [...st.steps];
      steps.splice(shiftAt.index, 0, { keys: [shift], layers: shiftAt.layers, press: 'hold', role: 'shift' });
      add(stroke(shifted, steps), st.cost + 1 + extra(pos));
    }
  };

  // 操作の少ない順に状態を広げる。同じレイヤーの状態には一番簡単な操作でだけ入る
  const seen = new Set<string>();
  let frontier: SearchState[] = [{ on: [], stickyShift: false, held: [], steps: [], cost: 0 }];
  while (frontier.length > 0) {
    const st = frontier.shift()!;
    const key = `${layersOf(st).join(',')}|${st.sticky ?? ''}|${st.stickyShift}`;
    if (seen.has(key)) continue;
    seen.add(key);
    emit(st);
    if (st.sticky !== undefined || st.steps.filter((t) => t.role === 'layer').length >= MAX_LAYER_STEPS) continue;
    frontier = [...frontier, ...nextStates(st)].sort((a, b) => a.cost - b.cost); // 安定ソートなので同じコストは先に見つけた順
  }

  const map = new Map<string, Stroke>();
  for (const s of candidates.sort((a, b) => costs.get(a)! - costs.get(b)!)) {
    if (!map.has(s.char)) map.set(s.char, s);
  }
  return { charMap: map, reachable: [...reachable].sort((a, b) => a - b) };
}

// キーテスト用: そのキーを単独で押したときにブラウザへ届く KeyboardEvent.code の候補
export function expectedCodes(b: Binding): string[] {
  const codes = [tapKeycode(b), holdKeycode(b)]; // ホールド側 (Shift など) でも可
  return codes.map((c) => c && keycodeToCode(c)).filter((c): c is string => !!c);
}

// ---- 位置の検索 (レッスンから使う) ----

export type Found = { layer: number; pos: number; layerKey?: number };

// ベースか、ホールド 1 つで行けるレイヤーから条件に合うキーを探す (ベース優先 → レイヤー番号順)
export function findKey(km: Keymap, match: (b: Binding) => boolean): Found | undefined {
  for (const layer of [km.base, ...[...km.layerKeys.keys()].sort((a, b) => a - b)]) {
    const layerKey = km.layerKeys.get(layer);
    const pos = km.kb.layers[layer].bindings.findIndex((b, p) => p !== layerKey && b.behavior !== 'trans' && match(b));
    if (pos >= 0) return { layer, pos, layerKey };
  }
  return undefined;
}

export const isKey =
  (keycode: string) =>
  (b: Binding): boolean =>
    behaviorDef(b)?.type === 'key' && b.params[0] === keycode;

export const isBehavior =
  (behavior: string, ...params: string[]) =>
  (b: Binding): boolean =>
    b.behavior === behavior && params.every((p, i) => b.params[i] === p);

// ベースレイヤーで、タップすると keycode を送るキー (レイヤーキーのタップ側も含む)
export function posOfTap(km: Keymap, keycode: string): number {
  return km.kb.layers[km.base].bindings.findIndex((b) => tapKeycode(b) === keycode);
}

export function comboPositions(kb: KeyboardData, keycode: string): number[] {
  return kb.combos.find((c) => tapKeycode(c.binding) === keycode)?.positions ?? [];
}
