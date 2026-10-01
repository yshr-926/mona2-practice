// ZMK の .keymap / .dtsi から練習アプリで使う最小限の情報を取り出すパーサ。
// 汎用の devicetree パーサではなく、moNa2 の設定ファイルが読めれば十分という前提。

export type Binding = {
  behavior: string; // 先頭の & を除いた名前 (kp, lt, mt, trans, ...)
  params: string[];
};

export type Layer = {
  name: string; // display-name があればそれ、なければノード名
  bindings: Binding[];
};

export type KeyGeometry = { x: number; y: number; w: number; h: number };

export type Combo = { name: string; positions: number[]; binding: Binding };

export type KeyboardData = {
  source: string;
  syncedAt: string;
  keys: KeyGeometry[];
  layers: Layer[];
  combos: Combo[];
};

export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// `name {` の直後から対応する `}` までを返す
function extractBlock(src: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(openIndex + 1, i);
    }
  }
  throw new Error('unbalanced braces');
}

// ブロック直下の子ノード (name { ... }) を列挙する
function childNodes(body: string): { name: string; body: string }[] {
  const nodes: { name: string; body: string }[] = [];
  const re = /([\w-]+)(?:\s*:\s*[\w-]+)?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].length - 1;
    const inner = extractBlock(body, open);
    nodes.push({ name: m[1], body: inner });
    re.lastIndex = open + inner.length + 2;
  }
  return nodes;
}

function findNode(src: string, compatible: string): string {
  const idx = src.indexOf(`compatible = "${compatible}"`);
  if (idx < 0) throw new Error(`node with compatible "${compatible}" not found`);
  const open = src.lastIndexOf('{', idx);
  return extractBlock(src, open);
}

export function parseBindings(text: string): Binding[] {
  return text
    .split('&')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [behavior, ...params] = chunk.split(/\s+/);
      return { behavior, params };
    });
}

function propertyCells(body: string, prop: string): string | undefined {
  return body.match(new RegExp(`(?:^|[\\s;])${prop}\\s*=\\s*<([\\s\\S]*?)>\\s*;`))?.[1];
}

function displayName(body: string): string | undefined {
  return body.match(/display-name\s*=\s*"([^"]*)"/)?.[1];
}

export function parseKeymap(src: string): { layers: Layer[]; combos: Combo[] } {
  const clean = stripComments(src);
  const layers = childNodes(findNode(clean, 'zmk,keymap'))
    .map(({ name, body }) => {
      const cells = propertyCells(body, 'bindings');
      return cells === undefined ? null : { name: displayName(body) ?? name, bindings: parseBindings(cells) };
    })
    .filter((l): l is Layer => l !== null);

  const combos = clean.includes('"zmk,combos"')
    ? childNodes(findNode(clean, 'zmk,combos')).map(({ name, body }) => ({
        name: displayName(body) ?? name,
        positions: (propertyCells(body, 'key-positions') ?? '').trim().split(/\s+/).map(Number),
        binding: parseBindings(propertyCells(body, 'bindings') ?? '')[0],
      }))
    : [];
  return { layers, combos };
}

// &key_physical_attrs w h x y rot rx ry を順番に読む
export function parsePhysicalLayout(dtsi: string): KeyGeometry[] {
  const re = /&key_physical_attrs\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/g;
  return [...stripComments(dtsi).matchAll(re)].map(([, w, h, x, y]) => ({
    w: Number(w) / 100,
    h: Number(h) / 100,
    x: Number(x) / 100,
    y: Number(y) / 100,
  }));
}
