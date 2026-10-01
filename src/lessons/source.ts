// 読み込んだ出どころに沿って、編集する設定ファイルを案内する。
import { KEYMAP_PATH, OVERLAY_PATH, type KeymapOrigin } from '../lib/keymap-source.ts';
import { escapeHtml } from '../ui/dom.ts';
const STANDARD_REPO = 'https://github.com/yshr-926/zmk-config-moNa2-v2';
const link = (url: string, label: string) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
export function sourceGuidance(origin: KeymapOrigin | undefined) {
  if (origin?.kind === 'file') return {
    keymap: `読み込んだファイル (${escapeHtml(origin.name)})`,
    overlay: '読み込んだファイルに対応する overlay (boards/shields/mona2/mona2_r.overlay)',
    build: '編集した設定からファームウェアをビルドして、右手側に書き込み直します。',
    sync: 'このアプリの画面は読み込んだファイルを元にしています。ZMK Studio での変更は反映されないので、編集後のファイルを読み込み直してください。',
  };
  if (!origin) return {
    keymap: `お使いの zmk-config のキーマップ (${link('https://zmk.dev/docs/config/keymap', 'ZMK 公式: キーマップの設定')})`,
    overlay: `お使いの zmk-config の overlay (${link('https://zmk.dev/docs/keymaps/input-processors', 'ZMK 公式: 入力プロセッサー')})`,
    build: `設定を編集し、${link('https://zmk.dev/docs/customization', 'ZMK 公式のビルド手順')}に沿ってファームウェアを作り、右手側に書き込み直します。`,
    sync: '変更したキーマップをこのアプリに読み込み直すと、練習のヒントも新しい配置に変わります。',
  };
  const repo = origin.kind === 'github' ? `https://github.com/${encodeURIComponent(origin.owner)}/${encodeURIComponent(origin.repo)}` : STANDARD_REPO;
  const branch = origin.kind === 'github' ? encodeURIComponent(origin.branch) : 'main';
  return {
    keymap: link(`${repo}/blob/${branch}/${origin.kind === 'github' ? origin.path.split('/').map(encodeURIComponent).join('/') : KEYMAP_PATH}`, origin.kind === 'github' ? origin.path : KEYMAP_PATH),
    overlay: link(`${repo}/blob/${branch}/${OVERLAY_PATH}`, 'mona2_r.overlay'),
    build: '変更をコミットして GitHub に反映し、GitHub Actions のビルドが終わったら右手側に書き込み直します。',
    sync: 'このアプリの画面は読み込んだキーマップを元にしています。ZMK Studio での変更は反映されないので、ヒントと合わせるにはリポジトリ側も編集し、キーマップを読み込み直してください。',
  };
}
