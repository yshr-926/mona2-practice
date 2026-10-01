// 練習に使うキーマップの出どころを管理する。
// 標準 (同梱の keyboard.json)・アップロードした .keymap・GitHub から取った .keymap を切り替え、
// 読み込んだ .keymap テキストと出どころを localStorage に保存して次回に復元する。
// 物理配置は moNa2 固定なので、どの出どころでも同梱の keys を使う。

import bundled from '../data/keyboard.json';
import { parseOverlay } from './overlay.ts';
import { parseKeymap, type KeyboardData } from './zmk.ts';

export type KeymapOrigin =
  | { kind: 'bundled' }
  | { kind: 'file'; name: string }
  | { kind: 'github'; url: string; owner: string; repo: string; branch: string; path: string };

export type StoredKeymap = {
  origin: KeymapOrigin;
  text: string; // 元の .keymap テキスト (標準のときは空)
  overlayText?: string;
  loadedAt: string;
};

export type KeymapState = {
  kb: KeyboardData;
  origin: KeymapOrigin;
  text?: string;
  overlayText?: string;
  error?: string; // 保存されていたキーマップが読めず標準に戻したときの理由
};

/** localStorage と同じ形。テストでは差し替える */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STORAGE_KEY = 'mona2-practice:keymap:v1';
const BUNDLED = bundled as KeyboardData;

export const KEYMAP_PATH = 'config/mona2.keymap';
export const OVERLAY_PATH = 'boards/shields/mona2/mona2_r.overlay';

export function bundledKeyboard(): KeyboardData {
  return BUNDLED;
}

/** .keymap テキストを読んで、同梱の物理配置と組み合わせる。moNa2 として使えないときは例外 */
export function keyboardFromKeymap(text: string, origin: KeymapOrigin, loadedAt = new Date().toISOString(), overlayText?: string): KeyboardData {
  let parsed: ReturnType<typeof parseKeymap>;
  try {
    parsed = parseKeymap(text);
  } catch (e) {
    throw new Error(`キーマップを読み取れませんでした (${e instanceof Error ? e.message : String(e)})`);
  }
  const { layers, combos, conditionalLayers } = parsed;
  const keys = BUNDLED.keys;
  if (layers.length === 0) throw new Error('レイヤーが見つかりませんでした。ZMK の .keymap ファイルか確認してください');
  for (const layer of layers) {
    if (layer.bindings.length !== keys.length) {
      throw new Error(`レイヤー「${layer.name}」のキーが ${layer.bindings.length} 個あります (moNa2 は ${keys.length} 個)`);
    }
  }
  for (const combo of combos) {
    if (!combo.binding || combo.positions.some((p) => !Number.isInteger(p) || p < 0 || p >= keys.length)) {
      throw new Error(`コンボ「${combo.name}」のキー位置が読み取れませんでした`);
    }
  }
  return { source: originLabel(origin), syncedAt: loadedAt, keys, layers, combos, ...(overlayText === undefined ? {} : { pointing: parseOverlay(overlayText, text) }), ...(conditionalLayers.length ? { conditionalLayers } : {}) };
}

export function originLabel(origin: KeymapOrigin): string {
  switch (origin.kind) {
    case 'bundled':
      return BUNDLED.source;
    case 'file':
      return origin.name;
    case 'github':
      return `${origin.owner}/${origin.repo}@${origin.branch}`;
  }
}

// ---- 保存と復元 ----

function defaultStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function bundledState(error?: string): KeymapState {
  return { kb: BUNDLED, origin: { kind: 'bundled' }, ...(error ? { error } : {}) };
}

function isOrigin(o: unknown): o is KeymapOrigin {
  if (!o || typeof o !== 'object') return false;
  const v = o as Record<string, unknown>;
  if (v.kind === 'file') return typeof v.name === 'string';
  if (v.kind === 'github') return ['url', 'owner', 'repo', 'branch', 'path'].every((k) => typeof v[k] === 'string');
  return false;
}

/** 保存されたキーマップを復元する。無い・壊れている・読めないときは標準に戻す */
export function restoreKeymap(storage: KeyValueStorage | undefined = defaultStorage()): KeymapState {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return bundledState();
  }
  if (raw === null) return bundledState();
  try {
    const stored = JSON.parse(raw) as Partial<StoredKeymap>;
    if (!isOrigin(stored?.origin) || typeof stored.text !== 'string') throw new Error('保存データの形式が違います');
    const kb = keyboardFromKeymap(stored.text, stored.origin, stored.loadedAt, typeof stored.overlayText === 'string' ? stored.overlayText : undefined);
    return { kb, origin: stored.origin, text: stored.text, overlayText: stored.overlayText };
  } catch (e) {
    clearStoredKeymap(storage);
    return bundledState(`保存されていたキーマップを読めなかったので、標準に戻しました: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 保存できたら true。標準を選んだときは保存を消す */
export function storeKeymap(state: KeymapState, storage: KeyValueStorage | undefined = defaultStorage()): boolean {
  if (state.origin.kind === 'bundled') return clearStoredKeymap(storage);
  const stored: StoredKeymap = { origin: state.origin, text: state.text ?? '', loadedAt: state.kb.syncedAt, overlayText: state.overlayText };
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

function clearStoredKeymap(storage: KeyValueStorage | undefined): boolean {
  try {
    storage?.removeItem(STORAGE_KEY);
    return !!storage;
  } catch {
    return false;
  }
}

// ---- 読み込み (各出どころ → KeymapState) ----

export function fromText(text: string, origin: Exclude<KeymapOrigin, { kind: 'bundled' }>, overlayText?: string): KeymapState {
  return { kb: keyboardFromKeymap(text, origin, undefined, overlayText), origin, text, overlayText };
}

export function fromBundled(): KeymapState {
  return bundledState();
}

export async function fromFile(file: Blob & { name: string }, overlay?: Blob): Promise<KeymapState> {
  return fromText(await file.text(), { kind: 'file', name: file.name }, await overlay?.text());
}

export async function fromGitHub(repoUrl: string, fetchFn: typeof fetch = fetch): Promise<KeymapState> {
  const got = await fetchGitHubFile(repoUrl, KEYMAP_PATH, fetchFn);
  let overlayText: string | undefined;
  try {
    overlayText = (await fetchGitHubFile(`${got.repoUrl}/tree/${got.branch}`, OVERLAY_PATH, fetchFn)).text;
  } catch {
    // overlay が無い・取得できない場合もキーマップ自体は利用できる。
  }
  return fromText(got.text, { kind: 'github', url: got.repoUrl, owner: got.owner, repo: got.repo, branch: got.branch, path: KEYMAP_PATH }, overlayText);
}

// ---- GitHub ----

export type GitHubRepo = { owner: string; repo: string; branch?: string };

/** `https://github.com/owner/repo`、`.../tree/<branch>`、`owner/repo` などを読む */
export function parseGitHubRepo(input: string): GitHubRepo | undefined {
  const s = input.trim().replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/[?#].*$/, '');
  const m = s.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/);
  if (!m) return undefined;
  return { owner: m[1], repo: m[2], ...(m[3] ? { branch: decodeURIComponent(m[3]) } : {}) };
}

export type GitHubFile = { text: string; owner: string; repo: string; branch: string; path: string; repoUrl: string; rawUrl: string };

/**
 * リポジトリ内の任意のファイルを raw.githubusercontent.com から取る。
 * ブランチの指定がなければ main → master の順に試す。
 */
export async function fetchGitHubFile(repoUrl: string, path: string, fetchFn: typeof fetch = fetch): Promise<GitHubFile> {
  const repo = parseGitHubRepo(repoUrl);
  if (!repo) throw new Error('GitHub のリポジトリ URL として読めませんでした (例: https://github.com/<ユーザー>/<リポジトリ>)');
  const branches = repo.branch ? [repo.branch] : ['main', 'master'];
  const cleanPath = path.replace(/^\/+/, '');
  for (const branch of branches) {
    const rawUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodeURIComponent(branch)}/${cleanPath}`;
    let res: Response;
    try {
      res = await fetchFn(rawUrl);
    } catch {
      throw new Error('GitHub に接続できませんでした。ネットワークを確認してください');
    }
    if (res.ok) {
      return {
        text: await res.text(),
        ...repo,
        branch,
        path: cleanPath,
        repoUrl: `https://github.com/${repo.owner}/${repo.repo}`,
        rawUrl,
      };
    }
    if (res.status !== 404) throw new Error(`GitHub からの取得に失敗しました (HTTP ${res.status})`);
  }
  throw new Error(`${repo.owner}/${repo.repo} の ${branches.join(' / ')} ブランチに ${cleanPath} が見つかりませんでした (公開リポジトリか確認してください)`);
}

// ---- 今のキーマップ ----

let current: KeymapState | undefined;

/** 今使っているキーマップの状態。初回は保存から復元する */
export function currentKeymap(): KeymapState {
  return (current ??= restoreKeymap());
}

export function currentKeyboard(): KeyboardData {
  return currentKeymap().kb;
}

/** 今のキーマップの出どころ (種類と URL / ファイル名) */
export function currentOrigin(): KeymapOrigin {
  return currentKeymap().origin;
}

/** キーマップを切り替えて保存する。保存できなかったら false (今回の表示だけ切り替わる) */
export function setCurrentKeymap(state: KeymapState, storage?: KeyValueStorage): boolean {
  current = { ...state, error: undefined };
  return storeKeymap(current, storage);
}
