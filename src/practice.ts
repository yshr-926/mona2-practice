// 自由練習モード。レッスンを終えたあとに毎日やる用。

import type { Keymap } from './lib/layout.ts';
import { DRILLS, pickLine } from './drills.ts';
import { loadStats, record, saveStats, weakest } from './stats.ts';
import type { KeyboardView } from './ui/keyboard.ts';
import { escapeHtml, h, visibleChar } from './ui/dom.ts';
import { mountTyping } from './ui/typing.ts';

export function mountPractice(
  root: HTMLElement,
  km: Keymap,
  setKeyboard: (v: KeyboardView) => void,
  outer: AbortSignal,
): void {
  const stats = loadStats();
  let drill = DRILLS[0];
  let line: string | undefined;
  let session: AbortController | undefined;

  const nav = h('nav', { className: 'drills' });
  const box = h('div');
  const weak = h('div', { className: 'weak' });
  root.append(nav, box, weak);

  const renderWeak = () => {
    const list = weakest(stats, 10);
    weak.innerHTML = list.length
      ? `<h3>苦手な文字</h3><ol>${list
          .map((w) => `<li><code>${escapeHtml(visibleChar(w.char))}</code> ${Math.round(w.rate * 100)}% (${w.misses})</li>`)
          .join('')}</ol>`
      : '';
  };

  const start = () => {
    session?.abort();
    session = new AbortController();
    outer.addEventListener('abort', () => session?.abort(), { signal: session.signal });
    nav.replaceChildren(
      ...DRILLS.map((d) =>
        h('button', {
          textContent: d.title,
          title: d.description,
          className: d === drill ? 'active' : '',
          onclick: () => {
            drill = d;
            start();
          },
        }),
      ),
    );
    box.replaceChildren();
    mountTyping(box, {
      km,
      signal: session.signal,
      nextLine: () => (line = pickLine(drill, (c) => km.charMap.has(c), line)),
      setKeyboard,
      onKey: (c, ok) => record(stats, c, ok),
      onLine: () => {
        saveStats(stats);
        renderWeak();
      },
    });
    renderWeak();
  };
  start();
}
