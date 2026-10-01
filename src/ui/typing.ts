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
  const marks = new Map<number, Mark>();
  const pressedIn = new Map<number, number[]>();
  for (const step of s.steps) {
    for (const k of step.keys) {
      marks.set(k, step.role === 'shift' ? 'shift' : 'hold');
      pressedIn.set(k, step.layers);
    }
  }
  marks.set(s.key, 'target');
  const hasTap = s.steps.some((t) => t.press !== 'hold');
  return {
    layer: s.layer,
    layers: s.layers,
    marks,
    pressedIn,
    caption:
      s.layer !== km.base
        ? `L${s.layer} ${km.kb.layers[s.layer].name} を表示中 (${hasTap ? '緑のキーを押したあと' : '緑のキーを押している間'}の配置)`
        : undefined,
  };
}

export function describeStroke(km: Keymap, s: Stroke): string {
  const name = (pos: number, layers: number[]) => {
    const { tap, hold } = bindingLabel(km.resolve(layers, pos));
    return escapeHtml(hold ? `${tap}/${hold}` : tap);
  };
  const parts = s.steps.map((step) => {
    const cls = step.role === 'shift' ? 'k-shift' : 'k-hold';
    const keys = step.keys.map((k) => `<b class="${cls}">${name(k, step.layers)}</b>`).join(' と ');
    const together = step.keys.length > 1 ? 'を同時に' : 'を';
    const action = { hold: '押したまま', sticky: '押して離してから', toggle: '押して切り替えてから' }[step.press];
    return `${keys} ${together}${action}`;
  });
  parts.push(`<b class="k-target">${name(s.key, s.layers)}</b>`);
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
