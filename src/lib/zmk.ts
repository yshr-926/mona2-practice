// ZMK の .keymap / .dtsi から練習アプリで使う最小限の情報を取り出すパーサ。
// 汎用の devicetree パーサではなく、moNa2 の設定ファイルが読めれば十分という前提。

export type Binding = {
  behavior: string; // 先頭の & を除いた名前 (kp, lt, mt, trans, ...)
  params: string[];
  def?: BehaviorDef; // 自作ビヘイビア・マクロのときだけ、定義から解決した正体
};

// ビヘイビアの正体。組み込みの kp / mo / mt / lt は名前から、
// 自作のもの (behaviors { } / macros { } で定義) は parseKeymap が定義から解決して Binding.def に入れる
export type BehaviorDef =
  | { type: 'key' } // &kp と同じ: params[0] のキーコードを送る
  | { type: 'layer' } // &mo と同じ: params[0] のレイヤーをホールド中だけ有効にする
  | { type: 'hold-tap'; hold: BehaviorDef; tap: BehaviorDef } // params[0] がホールド側、params[1] がタップ側
  | { type: 'other'; label: string }; // それ以外 (マクロなど)。label は表示名

const BUILTIN_BEHAVIORS: Record<string, BehaviorDef> = {
  kp: { type: 'key' },
  mo: { type: 'layer' },
  mt: { type: 'hold-tap', hold: { type: 'key' }, tap: { type: 'key' } },
  lt: { type: 'hold-tap', hold: { type: 'layer' }, tap: { type: 'key' } },
};

export function behaviorDef(b: Binding): BehaviorDef | undefined {
  return b.def ?? BUILTIN_BEHAVIORS[b.behavior];
}

export type Layer = {
  name: string; // display-name があればそれ、なければノード名
  bindings: Binding[];
};

export type KeyGeometry = { x: number; y: number; w: number; h: number };

export type Combo = { name: string; positions: number[]; binding: Binding };

export type PointingData = {
  scrollLayers: number[];
  autoMouseLayer?: number;
  scrollInvertX?: boolean;
  scrollInvertY?: boolean;
};

export type KeyboardData = {
  source: string;
  syncedAt: string;
  keys: KeyGeometry[];
  layers: Layer[];
  combos: Combo[];
  pointing?: PointingData; // overlay が無い・設定を読めないときは不明
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
// name は参照に使う名前 (ラベルがあればラベル)、nodeName はコロンの後ろのノード名
function childNodes(body: string): { name: string; nodeName: string; body: string }[] {
  const nodes: { name: string; nodeName: string; body: string }[] = [];
  const re = /([\w-]+)(?:\s*:\s*([\w-]+))?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].length - 1;
    const inner = extractBlock(body, open);
    nodes.push({ name: m[1], nodeName: m[2] ?? m[1], body: inner });
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

type Defines = Map<string, string>;

// オブジェクト形式の #define (#define MOUSE 5 など) を集める。関数形式のマクロは扱わない。
// #include 先のヘッダの定義 (keys.h の LSHIFT など) は読まず、キーコード名としてそのまま残す
export function parseDefines(src: string): Defines {
  const defines: Defines = new Map();
  for (const [, name, value] of stripComments(src.replace(/\\\r?\n/g, ' ')).matchAll(/^[ \t]*#[ \t]*define[ \t]+(\w+)(?![\w(])[ \t]*(.*)$/gm)) {
    defines.set(name, value.trim());
  }
  return defines;
}

// 識別子を #define の値に置き換える (値の中の識別子も展開する。自己参照は展開しない)
export function expandDefines(text: string, defines: Defines, seen: Set<string> = new Set()): string {
  if (defines.size === 0) return text;
  return text.replace(/\b[A-Za-z_]\w*\b/g, (id) => {
    const value = defines.get(id);
    if (value === undefined || seen.has(id)) return id;
    return expandDefines(value, defines, new Set(seen).add(id));
  });
}

// prop = <...>; の中身を返す。<&mo>, <&kp> のように複数の組があれば空白でつなぐ
function propertyCells(body: string, prop: string, defines: Defines = new Map()): string | undefined {
  const value = body.match(new RegExp(`(?:^|[\\s;])${prop}\\s*=\\s*((?:<[^>]*>\\s*,?\\s*)+);`))?.[1];
  if (value === undefined) return undefined;
  return expandDefines([...value.matchAll(/<([^>]*)>/g)].map((g) => g[1]).join(' '), defines);
}

function displayName(body: string): string | undefined {
  return body.match(/display-name\s*=\s*"([^"]*)"/)?.[1];
}

function compatibleOf(body: string): string | undefined {
  return body.match(/compatible\s*=\s*"([^"]*)"/)?.[1];
}

// behaviors { } / macros { } の定義から、自作ビヘイビアの正体を解決する (参照名 → 正体)
export function parseBehaviors(src: string, defines: Defines = parseDefines(src)): Record<string, BehaviorDef> {
  const clean = stripComments(src);
  const nodes = [...clean.matchAll(/\b(?:behaviors|macros)\s*\{/g)].flatMap((m) => childNodes(extractBlock(clean, m.index + m[0].length - 1)));
  const defs: Record<string, BehaviorDef> = {};
  const resolve = (name: string): BehaviorDef => defs[name] ?? BUILTIN_BEHAVIORS[name] ?? { type: 'other', label: name };

  // マクロを先に解決する (hold-tap のタップ側に自作マクロが来ることがあるため)
  for (const { name, nodeName, body } of nodes) {
    const compatible = compatibleOf(body);
    if (!compatible?.startsWith('zmk,behavior-macro')) continue;
    const bindings = parseBindings(propertyCells(body, 'bindings', defines) ?? '');
    // 受け取ったパラメータをそのまま &kp に渡すマクロ (&macro_param_1to1 &kp MACRO_PLACEHOLDER) はキーと同じ扱い
    const forwardsKey =
      compatible === 'zmk,behavior-macro-one-param' &&
      bindings.some((b, i) => b.behavior === 'macro_param_1to1' && bindings[i + 1]?.behavior === 'kp');
    defs[name] = forwardsKey ? { type: 'key' } : { type: 'other', label: displayName(body) ?? nodeName };
  }
  for (const { name, nodeName, body } of nodes) {
    const compatible = compatibleOf(body);
    if (compatible === 'zmk,behavior-hold-tap') {
      const [hold, tap] = parseBindings(propertyCells(body, 'bindings', defines) ?? '');
      defs[name] = hold && tap ? { type: 'hold-tap', hold: resolve(hold.behavior), tap: resolve(tap.behavior) } : { type: 'other', label: nodeName };
    } else if (compatible && !compatible.startsWith('zmk,behavior-macro')) {
      // sensor-rotate など、キーとしては扱わないもの
      defs[name] = { type: 'other', label: displayName(body) ?? nodeName };
    }
  }
  return defs;
}

export function parseKeymap(src: string): { layers: Layer[]; combos: Combo[] } {
  const clean = stripComments(src);
  const defines = parseDefines(src);
  const defs = parseBehaviors(src, defines);
  // 自作ビヘイビアなら正体を添える
  const withDefs = (bindings: Binding[]) => bindings.map((b) => (defs[b.behavior] ? { ...b, def: defs[b.behavior] } : b));

  const layers = childNodes(findNode(clean, 'zmk,keymap'))
    .map(({ name, body }) => {
      const cells = propertyCells(body, 'bindings', defines);
      return cells === undefined ? null : { name: displayName(body) ?? name, bindings: withDefs(parseBindings(cells)) };
    })
    .filter((l): l is Layer => l !== null);

  const combos = clean.includes('"zmk,combos"')
    ? childNodes(findNode(clean, 'zmk,combos')).map(({ name, body }) => ({
        name: displayName(body) ?? name,
        positions: (propertyCells(body, 'key-positions', defines) ?? '').trim().split(/\s+/).map(Number),
        binding: withDefs(parseBindings(propertyCells(body, 'bindings', defines) ?? ''))[0],
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
