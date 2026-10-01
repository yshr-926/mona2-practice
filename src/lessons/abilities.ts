// 文字入力と同じ探索経路を使い、機能の出し方を初心者向けの文と図にする。
import { bindingLabel, tapKeycode, type Keymap, type Stroke, type StrokeStep } from '../lib/layout.ts';
import { behaviorDef, type Binding } from '../lib/zmk.ts';
import { escapeHtml } from '../ui/dom.ts';
import type { KeyboardView, Mark } from '../ui/keyboard.ts';

export type Way = Pick<Stroke, 'layers' | 'layer' | 'steps'> & { keys: number[] };
export const keyName = (km: Keymap, pos: number, layers = [km.base]) => escapeHtml(bindingLabel(km.resolve(layers, pos)).tap || `キー ${pos + 1}`);
export function findWay(km: Keymap, match: (b: Binding) => boolean): Way | undefined {
  for (const route of km.routes) {
    const held = route.steps.filter(s => s.press === 'hold').flatMap(s => s.keys);
    const pos = km.kb.keys.findIndex((_, p) => !held.includes(p) && match(km.resolve(route.layers, p)));
    if (pos >= 0) return { ...route, layer: Math.max(...route.layers), keys: [pos] };
    const combo = km.kb.combos.find(c => (!c.layers || c.layers.some(l => route.layers.includes(l))) && !c.positions.some(p => held.includes(p)) && match(c.binding));
    if (combo) return { ...route, layer: Math.max(...route.layers), keys: combo.positions };
  }
}
export const keyWay = (km: Keymap, code: string) => findWay(km, b => tapKeycode(b) === code);
export function stepText(km: Keymap, s: StrokeStep): string {
  const name = [...s.keys].sort((a, b) => km.kb.keys[a].x - km.kb.keys[b].x).map(p => keyName(km, p, s.layers)).join(' + ');
  const combo = s.keys.length > 1 ? '同時に' : '';
  if (s.press === 'hold') return `${name} を${combo}押したまま`;
  if (s.press === 'sticky') return `${name} を${combo}押して離す (ワンショット: 次のキー 1 回だけ有効)`;
  const b = km.resolve(s.layers, s.keys[0]);
  const def = behaviorDef(b);
  const type = def?.type === 'hold-tap' ? def.tap.type : def?.type;
  return `${name} を${combo}タップしてレイヤーを切り替える${type === 'toggle-layer' ? ' (トグル: もう一度押すと戻る)' : ' (戻るときはベースに戻すキーを押す)'}`;
}
export const entryText = (km: Keymap, w: Pick<Way, 'steps'>) => w.steps.length ? w.steps.map(s => stepText(km, s)).join(' → ') : 'ベースの配置のまま';
export function wayText(km: Keymap, w: Way): string {
  const keys = w.keys.map(p => keyName(km, p)).join(' + ');
  return `${w.steps.length ? `${entryText(km, w)}、` : ''}${keys} を${w.keys.length > 1 ? '同時に' : ''}短く押す`;
}
export function wayView(w: Way | undefined): KeyboardView | undefined {
  if (!w) return undefined;
  const marks = new Map<number, Mark>();
  const pressedIn = new Map<number, number[]>();
  w.steps.forEach(s => s.keys.forEach(p => { marks.set(p, s.role === 'shift' ? 'shift' : s.press === 'hold' ? 'hold' : 'target'); pressedIn.set(p, s.layers); }));
  w.keys.forEach(p => marks.set(p, 'target'));
  return { layer: w.layer, layers: w.layers, marks, pressedIn };
}
export function layerEntry(km: Keymap, layer: number): Way | undefined {
  const r = km.routes.find(r => r.layers.includes(layer));
  return r && { ...r, layer, keys: [] };
}
export function layerContents(km: Keymap, layer: number): string {
  const bindings = km.kb.layers[layer].bindings;
  const codes = bindings.map(tapKeycode).filter((s): s is string => !!s);
  const items: string[] = [];
  if (codes.some(c => /^(N\d|NUMBER_\d)$/.test(c))) items.push('数字');
  if (codes.some(c => /EXCL|AT_SIGN|HASH|PLUS|EQUAL|BRACKET|PAREN|SQT|DQT|GRAVE|TILDE|BACKSLASH/.test(c))) items.push('記号・カッコ');
  if (codes.some(c => /ARROW/.test(c))) items.push('矢印・移動');
  if (codes.includes('DELETE')) items.push('Delete');
  if (codes.some(c => /^F\d+$/.test(c))) items.push('F キー');
  if (bindings.some(b => b.behavior === 'mkp')) items.push('マウスクリック');
  if (bindings.some(b => b.behavior === 'bt')) items.push('Bluetooth の切り替え');
  if (km.kb.pointing?.scrollLayers.includes(layer)) items.push('ボールでスクロール');
  return items.length ? items.join('、') : [...new Set(bindings.map(b => escapeHtml(bindingLabel(b).tap)).filter(Boolean))].slice(0, 8).join('、');
}
export function characterWay(km: Keymap, char: string): Way | undefined {
  const s = km.charMap.get(char);
  return s && { ...s, keys: [s.key] };
}
