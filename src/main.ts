import './style.css';
import type { KeyboardData } from './lib/zmk.ts';
import { currentKeymap, fromBundled, setCurrentKeymap, type KeymapState } from './lib/keymap-source.ts';
import { comboLayers, createKeymap, type Keymap } from './lib/layout.ts';
import { loadProgress, saveProgress } from './lib/progress.ts';
import { buildLessons, type Lesson } from './lessons/index.ts';
import { mountPractice } from './practice.ts';
import { renderKeyboard, type KeyboardView } from './ui/keyboard.ts';
import { h } from './ui/dom.ts';
import { startMonitor } from './ui/monitor.ts';
import { mountKeymapSettings } from './ui/keymap-settings.ts';

// キーマップから作るもの。キーマップを切り替えたら作り直す
let kb: KeyboardData;
let km: Keymap;
let lessons: Lesson[];
let reachable: number[];
const done = loadProgress();

function build(state: KeymapState) {
  const data = state.kb;
  const nextKm = createKeymap(data);
  const nextLessons = buildLessons(nextKm); // 読めないキーマップならここで例外 (切り替え前の状態は残る)
  kb = data;
  km = nextKm;
  lessons = nextLessons;
  // レイヤーのタブに出すのは、実際に行けるレイヤーだけ
  reachable = [...new Set([km.base, ...km.layerKeys.keys(), ...comboLayers(kb)])].sort((a, b) => a - b);
  const when = new Date(kb.syncedAt).toLocaleString();
  $('source').textContent = `keymap: ${kb.source} (${state.origin.kind === 'bundled' ? `標準, synced ${when}` : `読み込み ${when}`})`;
}

/** キーマップを切り替えて画面を作り直す。保存できなかったときは false */
function switchKeymap(state: KeymapState): boolean {
  build(state);
  return setCurrentKeymap(state);
}

const $ = (id: string) => document.getElementById(id)!;
let current: AbortController | undefined;

// ---- 目次 ----

function renderToc(activeId?: string) {
  const toc = $('toc');
  const chapters = [...new Set(lessons.map((l) => l.chapter))];
  // このキーマップでできない課題は数に入れない (クリア扱いにもしない)
  const doable = lessons.filter((l) => !l.missing);
  const skipped = lessons.length - doable.length;
  toc.replaceChildren(
    h('p', {
      className: 'progress',
      textContent: `${doable.filter((l) => done.has(l.id)).length} / ${doable.length} クリア${skipped ? ` (このキーマップでできない課題 ${skipped} 個)` : ''}`,
    }),
    ...chapters.map((ch) =>
      h(
        'section',
        {},
        h('h3', { textContent: ch }),
        h(
          'ol',
          {},
          ...lessons
            .filter((l) => l.chapter === ch)
            .map((l) =>
              h(
                'li',
                { className: [l.id === activeId ? 'active' : '', l.missing ? 'unavailable' : done.has(l.id) ? 'done' : ''].join(' ') },
                h('a', { href: `#/lesson/${l.id}`, textContent: l.title, title: l.missing ?? '' }),
              ),
            ),
        ),
      ),
    ),
    h('h3', { textContent: 'いつでも' }),
    h(
      'ol',
      {},
      h('li', { className: activeId === 'practice' ? 'active' : '' }, h('a', { href: '#/practice', textContent: '自由練習' })),
      h('li', { className: activeId === 'keymap' ? 'active' : '' }, h('a', { href: '#/keymap', textContent: 'キーマップの設定' })),
    ),
    h('button', {
      className: 'reset',
      textContent: '進み具合をリセット',
      onclick: () => {
        done.clear();
        saveProgress(done);
        renderToc(activeId);
      },
    }),
  );
}

// ---- キーボード図 (課題が指定した表示 + 手動で見るレイヤーのタブ) ----

function keyboardPanel(signal: AbortSignal, fallback?: KeyboardView) {
  const wrap = h('div', { className: 'kb-wrap' });
  const board = h('div');
  const tabs = h('div', { className: 'layer-tabs' });
  wrap.append(board, tabs);

  let taskView: KeyboardView | null = fallback ?? null;
  let manual: number | undefined;

  const render = () => {
    if (signal.aborted) return;
    const v = manual !== undefined ? { layer: manual } : taskView;
    wrap.hidden = !v;
    if (v) renderKeyboard(board, km, v);
    tabs.replaceChildren(
      ...[undefined, ...reachable].map((l) =>
        h('button', {
          textContent: l === undefined ? 'おすすめ表示' : `L${l} ${kb.layers[l].name}`,
          title: l === undefined ? '課題に合わせて自動で切り替え' : kb.layers[l].name,
          className: manual === l ? 'active' : '',
          onclick: () => {
            manual = l;
            render();
          },
        }),
      ),
    );
  };
  render();
  return {
    el: wrap,
    set: (v: KeyboardView | null) => {
      taskView = v ?? fallback ?? null;
      render();
    },
  };
}

// ---- レッスン画面 ----

function showLesson(lesson: Lesson) {
  const signal = begin();
  const index = lessons.indexOf(lesson);
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const content = $('content');

  const area = h('div', { className: 'task' });
  const banner = h('div', { className: 'banner', hidden: true });
  const kbPanel = keyboardPanel(signal, lesson.view);
  const body = h('div', { className: 'body' });
  body.innerHTML = lesson.body;

  const tips = lesson.tips?.length
    ? h('details', { className: 'tips', open: false }, h('summary', { textContent: 'うまくいかないときは' }), listOf(lesson.tips))
    : '';

  content.replaceChildren(
    h('p', { className: 'chapter', textContent: `${lesson.chapter}  ·  ${index + 1} / ${lessons.length}` }),
    h('h2', { textContent: lesson.title }, done.has(lesson.id) ? h('span', { className: 'badge', textContent: 'クリア済み' }) : ''),
    body,
    area,
    banner,
    kbPanel.el,
    tips,
    h(
      'nav',
      { className: 'pager' },
      prev ? h('a', { href: `#/lesson/${prev.id}`, textContent: `← ${prev.title}` }) : h('span'),
      next ? h('a', { href: `#/lesson/${next.id}`, textContent: `${next.title} →` }) : h('a', { href: '#/practice', textContent: '自由練習へ →' }),
    ),
  );

  // 押すキーが今のキーマップに無い課題は始めずに飛ばす。進み具合には記録しない (キーマップを戻せばまたできる)
  if (lesson.missing) {
    area.append(
      h('p', { className: 'warn', textContent: lesson.missing }),
      h('p', { textContent: 'この課題は飛ばして次へ進んでください。' }),
      next
        ? h('a', { className: 'primary', href: `#/lesson/${next.id}`, textContent: `飛ばして次へ: ${next.title} →` })
        : h('a', { className: 'primary', href: '#/practice', textContent: '飛ばして自由練習へ →' }),
    );
    renderToc(lesson.id);
    return;
  }

  let completed = false;
  lesson.task({
    km,
    area,
    signal,
    setKeyboard: kbPanel.set,
    complete: () => {
      if (completed || signal.aborted) return;
      completed = true;
      done.add(lesson.id);
      saveProgress(done);
      renderToc(lesson.id);
      banner.hidden = false;
      banner.replaceChildren(
        h('span', { textContent: 'クリア!' }),
        next
          ? h('a', { className: 'primary', href: `#/lesson/${next.id}`, textContent: `次へ: ${next.title} →` })
          : h('a', { className: 'primary', href: '#/practice', textContent: '自由練習へ →' }),
      );
    },
  });
  renderToc(lesson.id);
}

function showPractice() {
  const signal = begin();
  const content = $('content');
  const area = h('div', { className: 'task' });
  const kbPanel = keyboardPanel(signal);
  content.replaceChildren(
    h('p', { className: 'chapter', textContent: 'いつでも' }),
    h('h2', { textContent: '自由練習' }),
    h('p', { textContent: '好きなメニューを選んで打ちます。文字ごとのミス率が記録され、苦手な文字が下に出ます。' }),
    area,
    kbPanel.el,
  );
  mountPractice(area, km, kbPanel.set, signal);
  renderToc('practice');
}

function showKeymapSettings() {
  const signal = begin();
  const content = $('content');
  const area = h('div');
  content.replaceChildren(h('p', { className: 'chapter', textContent: 'いつでも' }), h('h2', { textContent: 'キーマップの設定' }), area);
  mountKeymapSettings(area, { current: currentKeymap(), apply: switchKeymap, signal });
  renderToc('keymap');
}

function begin(): AbortSignal {
  current?.abort();
  current = new AbortController();
  window.scrollTo(0, 0);
  return current.signal;
}

function listOf(items: string[]) {
  const ul = h('ul');
  ul.innerHTML = items.map((t) => `<li>${t}</li>`).join('');
  return ul;
}

// ---- ルーティング ----

function route() {
  const m = location.hash.match(/^#\/(lesson|practice|keymap)\/?([\w-]*)/);
  if (m?.[1] === 'practice') return showPractice();
  if (m?.[1] === 'keymap') return showKeymapSettings();
  const lesson = lessons.find((l) => l.id === m?.[2]) ?? lessons.find((l) => !done.has(l.id) && !l.missing) ?? lessons[0];
  showLesson(lesson);
}

// ---- ページ全体のキー操作を止める ----
// Space でスクロール、Tab でフォーカス移動、Cmd+← でブラウザの「戻る」などが起きると練習にならないため。
// ただしテキスト欄 (日本語入力の練習) の中では普通に使えるようにする。
const BLOCKED = new Set(['Space', 'Tab', 'Enter', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
window.addEventListener(
  'keydown',
  (e) => {
    if (e.isComposing || (e.target as HTMLElement).closest?.('input, textarea')) return;
    if (BLOCKED.has(e.code) || (e.metaKey && e.key.length === 1 && e.key !== 'r')) e.preventDefault(); // Cmd+R (再読み込み) だけは残す
  },
  true,
);
// クリックしたボタンにフォーカスが残ると、次の Enter / Space で押されてしまう
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button, a')) (document.activeElement as HTMLElement | null)?.blur();
});

startMonitor($('monitor'));
try {
  build(currentKeymap());
} catch {
  // 保存されていたキーマップではレッスンを作れなかったので標準に戻す
  switchKeymap(fromBundled());
}
window.addEventListener('hashchange', route);
route();
