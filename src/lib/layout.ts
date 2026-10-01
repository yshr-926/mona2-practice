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
// レイヤー 0 がベース。ほかのレイヤーには「ベースのキーを押しっぱなしにする」ことで入る。

export type Keymap = {
  kb: KeyboardData;
  base: number;
  layout: KeyboardLayout;
  // ベースで押しっぱなしにするとそのレイヤーになるキー
  layerKeys: Map<number, number>;
  effective: (layer: number, pos: number) => Binding;
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
  // &trans はベースレイヤーへ落ちる
  const effective = (layer: number, pos: number) => {
    const b = kb.layers[layer].bindings[pos];
    return b.behavior === 'trans' ? kb.layers[base].bindings[pos] : b;
  };
  const km: Keymap = { kb, base, layout, layerKeys, effective, charMap: new Map() };
  km.charMap = buildCharMap(km);
  return km;
}

// コンボを押しっぱなしにすると入るレイヤー (英数 + かな の L4 など)
export function comboLayers(kb: KeyboardData): number[] {
  return kb.combos.map((c) => holdLayer(c.binding)).filter((l): l is number => l !== undefined);
}

// ある文字を打つために同時に押す物理キー (position) の組
export type Stroke = {
  char: string;
  layer: number;
  key: number; // 文字キーの position
  layerKey?: number; // レイヤーを有効にするためホールドするキー
  shiftKey?: number; // Shift としてホールドするキー
};

function isShift(b: Binding): boolean {
  return (
    /SHIFT|SHFT/.test(holdKeycode(b) ?? '') ||
    (behaviorDef(b)?.type === 'key' && /^(LEFT_SHIFT|LSHFT|RIGHT_SHIFT|RSHFT)$/.test(b.params[0]))
  );
}

function buildCharMap(km: Keymap): Map<string, Stroke> {
  const { kb, base } = km;
  const mid = (Math.min(...kb.keys.map((k) => k.x)) + Math.max(...kb.keys.map((k) => k.x))) / 2;
  const side = (pos: number) => kb.keys[pos].x < mid;

  const candidates: Stroke[] = [];
  for (const layer of [base, ...km.layerKeys.keys()]) {
    const layerKey = km.layerKeys.get(layer);
    const positions = kb.layers[layer].bindings.map((_, pos) => pos).filter((pos) => pos !== layerKey);
    const shiftKeys = positions.filter((pos) => isShift(km.effective(layer, pos)));

    for (const pos of positions) {
      const code = tapKeycode(km.effective(layer, pos));
      const char = code && keycodeToChar(code, km.layout);
      if (!char) continue;
      candidates.push({ char, layer, key: pos, layerKey });
      const shifted = keycodeToChar(code!, km.layout, true);
      // Shift は打つキーと反対の手を優先する (タイピングの基本)
      const shiftKey = shiftKeys.filter((s) => s !== pos).sort((a, b) => Number(side(a) === side(pos)) - Number(side(b) === side(pos)))[0];
      if (shifted && shifted !== char && shiftKey !== undefined) candidates.push({ char: shifted, layer, key: pos, layerKey, shiftKey });
    }
  }

  // 同時に押すキーが少ない順、同数ならベース → レイヤー番号が小さい方。
  // 同じ文字を出すキーが複数あれば、長押しで別の役割になるキー (lt / mt) より普通のキーを選ぶ
  const cost = (s: Stroke) =>
    (s.layerKey !== undefined ? 1 : 0) +
    (s.shiftKey !== undefined ? 1 : 0) +
    (s.layer === base ? 0 : 0.01 + s.layer * 0.001) +
    (behaviorDef(km.effective(s.layer, s.key))?.type === 'key' ? 0 : 0.0001);
  const map = new Map<string, Stroke>();
  for (const s of candidates.sort((a, b) => cost(a) - cost(b))) {
    if (!map.has(s.char)) map.set(s.char, s);
  }
  return map;
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
