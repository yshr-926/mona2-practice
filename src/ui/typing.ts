// 文字列を打つ練習の共通部品。レッスン (決まった行を順番に) と自由練習 (ランダムに延々) の両方で使う。

import type { Keymap, Stroke } from '../lib/layout.ts';
import { bindingLabel } from '../lib/layout.ts';
import type { KeyboardView, Mark } from './keyboard.ts';
import { escapeHtml, h, visibleChar } from './dom.ts';

export type LineResult = { line: string; wpm: number; accuracy: number };

export type TypingOptions = {
  km: Keymap;
  signal: AbortSignal;
  nextLine: () => string | undefined; // undefined で終了
  setKeyboard: (view: KeyboardView) => void;
  onKey?: (char: string, ok: boolean) => void;
  onLine?: (r: LineResult) => void;
  onFinish?: () => void;
};

export function isComposing(e: KeyboardEvent): boolean {
  return e.isComposing || e.key === 'Process' || e.keyCode === 229;
}

export function strokeView(km: Keymap, s: Stroke): KeyboardView {
  const marks = new Map<number, Mark>([[s.key, 'target']]);
  if (s.layerKey !== undefined) marks.set(s.layerKey, 'hold');
  if (s.shiftKey !== undefined) marks.set(s.shiftKey, 'shift');
  return {
    layer: s.layer,
    marks,
    caption: s.layer !== km.base ? `L${s.layer} ${km.kb.layers[s.layer].name} を表示中 (緑のキーを押している間の配置)` : undefined,
  };
}

export function describeStroke(km: Keymap, s: Stroke): string {
  const name = (pos: number, layer: number) => {
    const { tap, hold } = bindingLabel(km.effective(layer, pos));
    return escapeHtml(hold ? `${tap}/${hold}` : tap);
  };
  const parts: string[] = [];
  if (s.layerKey !== undefined) parts.push(`<b class="k-hold">${name(s.layerKey, km.base)}</b> を押したまま`);
  if (s.shiftKey !== undefined) parts.push(`<b class="k-shift">${name(s.shiftKey, s.layer)}</b> を押したまま`);
  parts.push(`<b class="k-target">${name(s.key, s.layer)}</b>`);
  return parts.join(' + ');
}

export function mountTyping(root: HTMLElement, o: TypingOptions): void {
  const prompt = h('div', { className: 'prompt' });
  const hint = h('div', { className: 'hint' });
  const status = h('div', { className: 'status' });
  root.append(prompt, hint, status);

  let line = '';
  let index = 0;
  let misses = 0;
  let missedAt = new Set<number>();
  let startedAt: number | undefined;

  // 今のキーマップで打てない文字は飛ばす (詰まらないように)
  const skipUntypable = () => {
    while (index < line.length && !o.km.charMap.has(line[index])) index++;
  };

  const load = () => {
    const next = o.nextLine();
    if (next === undefined) {
      o.onFinish?.();
      return false;
    }
    line = next;
    index = 0;
    misses = 0;
    missedAt = new Set();
    startedAt = undefined;
    skipUntypable();
    return true;
  };

  const render = () => {
    prompt.replaceChildren(
      ...[...line].map((c, i) =>
        h('span', {
          textContent: visibleChar(c),
          className: [i < index ? 'done' : i === index ? 'cursor' : 'todo', missedAt.has(i) ? 'missed' : '', c === ' ' ? 'space' : ''].join(' '),
        }),
      ),
    );
    const s = o.km.charMap.get(line[index]);
    if (s) {
      hint.innerHTML = `次の文字 <code>${escapeHtml(visibleChar(s.char))}</code> … ${describeStroke(o.km, s)}`;
      o.setKeyboard(strokeView(o.km, s));
    } else {
      hint.textContent = '';
    }
  };

  window.addEventListener(
    'keydown',
    (e) => {
      if (isComposing(e)) {
        status.innerHTML = '<span class="warn">日本語入力になっています。英字入力に切り替えてから打ち直してください。</span>';
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      if (index >= line.length) return; // 出す行が無い (終わった) とき
      e.preventDefault();

      const expected = line[index];
      startedAt ??= performance.now();
      const ok = e.key === expected;
      o.onKey?.(expected, ok);

      if (!ok) {
        misses++;
        missedAt.add(index);
        status.innerHTML = `<span class="warn">「${escapeHtml(visibleChar(e.key))}」が入力されました。ヒントの通りに押してみてください。</span>`;
        prompt.classList.remove('shake');
        void prompt.offsetWidth; // アニメーションを再生し直す
        prompt.classList.add('shake');
        render();
        return;
      }

      index++;
      skipUntypable();
      if (index < line.length) {
        render();
        return;
      }
      const minutes = (performance.now() - startedAt) / 60000;
      const result = {
        line,
        wpm: Math.round(line.length / 5 / Math.max(minutes, 1e-6)),
        accuracy: Math.round((line.length / (line.length + misses)) * 100),
      };
      status.textContent = `前の行: ${result.wpm} WPM / 正確率 ${result.accuracy}%`;
      o.onLine?.(result);
      if (load()) render();
      else {
        prompt.replaceChildren();
        hint.textContent = '';
      }
    },
    { signal: o.signal },
  );

  if (load()) render();
}
