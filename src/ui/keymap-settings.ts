// キーマップの読み込み画面。標準・.keymap ファイル・GitHub リポジトリから選ぶ。

import { KEYMAP_PATH, currentKeymap, fromBundled, fromFile, fromGitHub, originLabel, type KeymapState } from '../lib/keymap-source.ts';
import { currentLayoutPreference, detectedLayout, setLayoutPreference, type LayoutPreference } from '../lib/os-layout.ts';
import { h } from './dom.ts';

type Options = {
  current: KeymapState;
  /** キーマップを切り替える。保存できなかったら false、使えないキーマップなら例外 */
  apply: (state: KeymapState) => boolean;
  applyLayout: () => void;
  signal: AbortSignal;
};

export function mountKeymapSettings(area: HTMLElement, { current, apply, applyLayout, signal }: Options) {
  const status = h('div', { className: 'keymap-status' });
  const message = h('p', { className: 'keymap-message', hidden: true });

  const showStatus = (state: KeymapState) => {
    const o = state.origin;
    const where =
      o.kind === 'bundled'
        ? h('span', { textContent: `標準のキーマップ (${originLabel(o)})` })
        : o.kind === 'file'
          ? h('span', { textContent: `ファイル: ${o.name}` })
          : h('span', {}, 'GitHub: ', h('a', { href: o.url, target: '_blank', rel: 'noopener', textContent: originLabel(o) }), ` の ${o.path}`);
    status.replaceChildren(h('strong', { textContent: '今のキーマップ: ' }), where);
  };

  const say = (text: string, kind: 'ok' | 'error') => {
    message.hidden = false;
    message.className = `keymap-message ${kind}`;
    message.textContent = text;
  };

  const run = async (load: () => KeymapState | Promise<KeymapState>, button?: HTMLButtonElement) => {
    if (button) button.disabled = true;
    try {
      const state = await load();
      if (signal.aborted) return;
      const saved = apply(state);
      showStatus(state);
      say(
        saved ? `${originLabel(state.origin)} を読み込みました。レッスンと自由練習はこのキーマップで表示されます。` : '読み込みましたが、ブラウザに保存できませんでした。次に開いたときは標準に戻ります。',
        saved ? 'ok' : 'error',
      );
    } catch (e) {
      if (!signal.aborted) say(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      if (button) button.disabled = false;
    }
  };

  // GitHub
  const url = h('input', {
    type: 'url',
    className: 'keymap-url',
    placeholder: 'https://github.com/<ユーザー>/zmk-config-moNa2-v2',
    value: current.origin.kind === 'github' ? current.origin.url : '',
  });
  const fetchButton: HTMLButtonElement = h('button', {
    textContent: 'GitHub から読み込む',
    onclick: () => run(() => fromGitHub(url.value), fetchButton),
  });
  url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) fetchButton.click();
  });

  // ファイル
  const file = h('input', { type: 'file', accept: '.keymap,.dtsi,.txt,.overlay', multiple: true });
  file.addEventListener('change', () => {
    const files = Array.from(file.files ?? []);
    const overlay = files.find((f) => f.name.endsWith('.overlay'));
    const f = files.find((f) => !f.name.endsWith('.overlay'));
    if (f) run(() => fromFile(f, overlay)).finally(() => (file.value = ''));
  });

  // 標準
  const resetButton: HTMLButtonElement = h('button', {
    textContent: '標準のキーマップに戻す',
    onclick: () => run(fromBundled, resetButton),
  });

  const layoutSelect = h('select', { id: 'os-layout' },
    ...([['auto', '自動'], ['us', 'US'], ['jis', 'JIS']] as const).map(([value, textContent]) => h('option', { value, textContent })),
  );
  layoutSelect.value = currentLayoutPreference();
  layoutSelect.addEventListener('change', () => {
    const saved = setLayoutPreference(layoutSelect.value as LayoutPreference);
    applyLayout();
    say(saved ? '配列を変更しました。レッスンと自由練習の課題・ヒントに反映されます。' : '配列を変更しましたが、ブラウザに保存できませんでした。', saved ? 'ok' : 'error');
  }, { signal });
  const detected = detectedLayout();

  area.replaceChildren(
    h('section', { className: 'keymap-option' },
      h('h3', { textContent: 'Mac のキーボード配列' }),
      h('p', { textContent: detected ? `自動判定: ${detected.toUpperCase()}。手動選択が優先されます。` : '自動判定できないため、自動では US を使います。Mac の入力設定に合わせて US / JIS を選んでください。' }),
      h('label', { htmlFor: 'os-layout', textContent: '配列: ' }), layoutSelect,
      h('p', { textContent: 'JIS の ¥ キーは ¥ として扱います。Mac の「¥ キーで入力する文字」設定も合わせてください。' }),
    ),
    h('p', { textContent: '自分の moNa2 のキーマップで練習したいときは、ここで読み込みます。読み込んだキーマップはこのブラウザに保存され、次に開いたときも使われます。' }),
    status,
    message,
    h(
      'section',
      { className: 'keymap-option' },
      h('h3', { textContent: 'GitHub のリポジトリから' }),
      h('p', { textContent: `zmk-config の公開リポジトリの URL を入れてください。${KEYMAP_PATH} を main → master の順に探します。` }),
      h('div', { className: 'keymap-row' }, url, fetchButton),
    ),
    h(
      'section',
      { className: 'keymap-option' },
      h('h3', { textContent: 'ファイルから' }),
      h('p', { textContent: '手元の mona2.keymap を選んでください。mona2_r.overlay も一緒に選ぶとスクロール設定を読み込めます。' }),
      file,
    ),
    h('section', { className: 'keymap-option' }, h('h3', { textContent: '標準に戻す' }), h('p', { textContent: 'このアプリに同梱している作者のキーマップを使います。' }), resetButton),
  );

  showStatus(current);
  const restoreError = currentKeymap().error;
  if (restoreError) say(restoreError, 'error');
}
