import { bindingLabel, type Keymap } from '../lib/layout.ts';
import { escapeHtml } from './dom.ts';

// target = 押すキー / hold = ホールドするキー / shift = Shift / ok = 確認済み / skip = 飛ばした / warn = 注意
export type Mark = 'target' | 'hold' | 'shift' | 'ok' | 'skip' | 'warn';

export type KeyboardView = {
  layer: number;
  marks?: Map<number, Mark>;
  caption?: string;
  missing?: boolean; // 押すキー (target / hold / shift) が今のキーマップに見つからなかった
  layers?: number[]; // 有効なレイヤーが複数のとき全部 (&trans を下のレイヤーへ落として表示する)
  pressedIn?: Map<number, number[]>; // 先に押したキーと、押したときに有効だったレイヤー (そのときの表示にする)
};

export function renderKeyboard(el: HTMLElement, km: Keymap, view: KeyboardView): void {
  const { kb } = km;
  const maxX = Math.max(...kb.keys.map((k) => k.x + k.w));
  const maxY = Math.max(...kb.keys.map((k) => k.y + k.h));

  const board = document.createElement('div');
  board.className = 'keyboard';
  board.style.setProperty('--cols', String(maxX));
  board.style.setProperty('--rows', String(maxY));

  for (const [pos, g] of kb.keys.entries()) {
    const b = kb.layers[view.layer].bindings[pos];
    // &trans (そのレイヤーでは変わらないキー) は下のレイヤー (ふつうはベース) の表示を薄く出す。
    // そのレイヤーに入るために先に押したキーは、押したときの表示にする
    const pressedIn = view.pressedIn?.get(pos) ?? (km.layerKeys.get(view.layer) === pos ? [km.base] : undefined);
    const { tap, hold } = bindingLabel(km.resolve(pressedIn ?? view.layers ?? [km.base, view.layer], pos));
    const key = document.createElement('div');
    key.className = 'key';
    if (b.behavior === 'trans' && view.layer !== km.base) key.classList.add('trans');
    if (tap.length > 4) key.classList.add('long');
    const mark = view.marks?.get(pos);
    if (mark) key.classList.add(mark);
    key.style.cssText = `--x:${g.x};--y:${g.y};--w:${g.w};--h:${g.h}`;
    key.innerHTML = `<span class="tap">${escapeHtml(tap)}</span>${hold ? `<span class="hold">${escapeHtml(hold)}</span>` : ''}`;
    board.append(key);
  }

  const caption = document.createElement('p');
  caption.className = 'kb-caption';
  caption.textContent = view.caption ?? `表示中: L${view.layer} ${kb.layers[view.layer].name}`;

  el.replaceChildren(board, caption);
}
