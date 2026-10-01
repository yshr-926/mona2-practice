import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  bundledKeyboard,
  fetchGitHubFile,
  fromFile,
  fromGitHub,
  fromText,
  keyboardFromKeymap,
  parseGitHubRepo,
  restoreKeymap,
  storeKeymap,
  type KeyValueStorage,
} from './keymap-source.ts';

// 同梱の標準キーマップと同じ形の .keymap を組み立てる (レイヤー数やキー数を変えて壊せるように)
const kb = bundledKeyboard();
const cells = (bindings: { behavior: string; params: string[] }[]) =>
  bindings.map((b) => ['&' + b.behavior, ...b.params].join(' ')).join(' ');
function keymapText(layers = kb.layers, extra = '') {
  return `/ { ${extra}
  keymap { compatible = "zmk,keymap";
    ${layers.map((l, i) => `layer${i} { display-name = "${l.name}"; bindings = <${cells(l.bindings)}>; };`).join('\n')}
  };
};`;
}
const VALID = keymapText();

function memoryStorage(init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}
const throwingStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('keyboardFromKeymap', () => {
  it('parses a .keymap and combines it with the bundled physical layout', () => {
    const got = keyboardFromKeymap(VALID, { kind: 'file', name: 'mona2.keymap' });
    expect(got.layers).toEqual(kb.layers);
    expect(got.keys).toBe(kb.keys);
    expect(got.source).toBe('mona2.keymap');
  });

  it('reads the real zmk-config keymap the same as the bundled data', () => {
    const path = `${process.env.HOME}/zmk-config-moNa2-v2/config/mona2.keymap`;
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      return; // zmk-config が無い環境では飛ばす
    }
    const got = keyboardFromKeymap(text, { kind: 'file', name: 'mona2.keymap' });
    expect(got.layers.length).toBeGreaterThan(0);
    expect(got.layers.every((l) => l.bindings.length === kb.keys.length)).toBe(true);
  });

  it('rejects text without layers', () => {
    expect(() => keyboardFromKeymap('hello', { kind: 'file', name: 'x.txt' })).toThrow();
    expect(() => keyboardFromKeymap('/ { keymap { compatible = "zmk,keymap"; }; };', { kind: 'file', name: 'x' })).toThrow(/レイヤー/);
  });

  it('rejects a keymap for a different number of keys', () => {
    const short = kb.layers.map((l) => ({ ...l, bindings: l.bindings.slice(1) }));
    expect(() => keyboardFromKeymap(keymapText(short), { kind: 'file', name: 'x' })).toThrow(/moNa2 は 42 個/);
  });
});

describe('save and restore', () => {
  it('starts with the bundled keymap when nothing is saved', () => {
    const s = restoreKeymap(memoryStorage());
    expect(s.origin).toEqual({ kind: 'bundled' });
    expect(s.kb).toBe(kb);
    expect(s.error).toBeUndefined();
  });

  it('restores a saved keymap with its origin', () => {
    const storage = memoryStorage();
    const origin = { kind: 'github', url: 'https://github.com/a/b', owner: 'a', repo: 'b', branch: 'main', path: 'config/mona2.keymap' } as const;
    expect(storeKeymap(fromText(VALID, origin), storage)).toBe(true);
    const s = restoreKeymap(storage);
    expect(s.origin).toEqual(origin);
    expect(s.text).toBe(VALID);
    expect(s.kb.layers).toEqual(kb.layers);
    expect(s.kb.source).toBe('a/b@main');
  });

  it('choosing the bundled keymap clears the saved one', () => {
    const storage = memoryStorage();
    storeKeymap(fromText(VALID, { kind: 'file', name: 'x' }), storage);
    storeKeymap(restoreKeymap(memoryStorage()), storage);
    expect(storage.data).toEqual({});
  });

  it('falls back to bundled and drops broken data', () => {
    for (const raw of ['{', '"x"', 'null', JSON.stringify({ origin: { kind: 'file', name: 'x' }, text: 'garbage' }), JSON.stringify({ origin: { kind: 'evil' }, text: VALID })]) {
      const storage = memoryStorage({ 'mona2-practice:keymap:v1': raw });
      const s = restoreKeymap(storage);
      expect(s.origin).toEqual({ kind: 'bundled' });
      expect(s.error).toContain('標準に戻しました');
      expect(storage.data).toEqual({});
    }
  });

  it('works without usable localStorage', () => {
    expect(restoreKeymap(throwingStorage).origin).toEqual({ kind: 'bundled' });
    expect(restoreKeymap(undefined).origin).toEqual({ kind: 'bundled' });
    expect(storeKeymap(fromText(VALID, { kind: 'file', name: 'x' }), throwingStorage)).toBe(false);
  });
});

describe('fromFile', () => {
  it('reads an uploaded file', async () => {
    const s = await fromFile(new File([VALID], 'my.keymap'));
    expect(s.origin).toEqual({ kind: 'file', name: 'my.keymap' });
    expect(s.kb.layers).toEqual(kb.layers);
  });
});

describe('GitHub', () => {
  it('parses repository URLs', () => {
    expect(parseGitHubRepo('https://github.com/yshr-926/zmk-config-moNa2-v2')).toEqual({ owner: 'yshr-926', repo: 'zmk-config-moNa2-v2' });
    expect(parseGitHubRepo('github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGitHubRepo('a/b')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGitHubRepo('https://github.com/a/b/tree/dev')).toEqual({ owner: 'a', repo: 'b', branch: 'dev' });
    expect(parseGitHubRepo('https://github.com/a/b/')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseGitHubRepo('https://example.com/a')).toBeUndefined();
    expect(parseGitHubRepo('')).toBeUndefined();
  });

  const fakeFetch = (files: Record<string, string>, calls: string[] = []) =>
    (async (url: string) => {
      calls.push(url);
      return url in files ? new Response(files[url]) : new Response('404', { status: 404 });
    }) as unknown as typeof fetch;

  it('tries main then master and accepts any path', async () => {
    const calls: string[] = [];
    const f = fakeFetch({ 'https://raw.githubusercontent.com/a/b/master/boards/shields/mona2/mona2_r.overlay': 'overlay' }, calls);
    const got = await fetchGitHubFile('https://github.com/a/b', 'boards/shields/mona2/mona2_r.overlay', f);
    expect(got.text).toBe('overlay');
    expect(got.branch).toBe('master');
    expect(calls).toEqual([
      'https://raw.githubusercontent.com/a/b/main/boards/shields/mona2/mona2_r.overlay',
      'https://raw.githubusercontent.com/a/b/master/boards/shields/mona2/mona2_r.overlay',
    ]);
  });

  it('loads config/mona2.keymap and records the origin', async () => {
    const s = await fromGitHub('a/b', fakeFetch({ 'https://raw.githubusercontent.com/a/b/main/config/mona2.keymap': VALID }));
    expect(s.origin).toEqual({ kind: 'github', url: 'https://github.com/a/b', owner: 'a', repo: 'b', branch: 'main', path: 'config/mona2.keymap' });
    expect(s.kb.layers).toEqual(kb.layers);
  });

  it('reports missing files, HTTP errors and network errors', async () => {
    await expect(fetchGitHubFile('a/b', 'config/mona2.keymap', fakeFetch({}))).rejects.toThrow(/見つかりませんでした/);
    await expect(fetchGitHubFile('nope', 'x', fakeFetch({}))).rejects.toThrow(/URL/);
    const forbidden = (async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    await expect(fetchGitHubFile('a/b', 'x', forbidden)).rejects.toThrow(/403/);
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(fetchGitHubFile('a/b', 'x', offline)).rejects.toThrow(/接続/);
  });

  it('rejects a fetched file that is not a moNa2 keymap', async () => {
    await expect(fromGitHub('a/b', fakeFetch({ 'https://raw.githubusercontent.com/a/b/main/config/mona2.keymap': '<html>' }))).rejects.toThrow();
  });
});
