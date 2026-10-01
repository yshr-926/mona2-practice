// moNa2 の input listener からスクロール設定を読む純粋関数。
import { expandDefines, parseDefines, stripComments, type PointingData } from './zmk.ts';

type Node = { name: string; body: string; children: Node[] };

function nodes(src: string): Node[] {
  const result: Node[] = [];
  const re = /(&?[\w-]+)(?:\s*:\s*[\w-]+)?(?:@[\w,]+)?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = re.lastIndex;
    let depth = 1;
    let end = start;
    while (end < src.length && depth) {
      if (src[end] === '{') depth++;
      if (src[end] === '}') depth--;
      end++;
    }
    if (depth) return result;
    const inner = src.slice(start, end - 1);
    const children = nodes(inner);
    // 子ノードのプロパティを親のものと混同しない。
    let body = inner;
    while (/\{[^{}]*\}/.test(body)) body = body.replace(/[^;{}]*\{[^{}]*\}\s*;?/g, '');
    result.push({ name: m[1], body, children });
    re.lastIndex = end;
  }
  return result;
}

function cells(body: string, property: string): string | undefined {
  return body.match(new RegExp(`${property}\\s*=\\s*([^;]*);`))?.[1];
}

/** 未知の overlay は undefined。既知の listener にスクロール設定が無ければ空配列。 */
export function parseOverlay(src: string, defineSource = ''): PointingData | undefined {
  const clean = expandDefines(stripComments(src).replace(/^[ \t]*#.*$/gm, ''), parseDefines(defineSource + '\n' + src));
  const listeners: Node[] = [];
  const visit = (items: Node[]) => {
    for (const node of items) {
      if (/status\s*=\s*"disabled"/.test(node.body)) continue;
      if (/listener/.test(node.name) || /compatible\s*=\s*"zmk,input-listener"/.test(node.body)) listeners.push(node);
      visit(node.children);
    }
  };
  visit(nodes(clean));
  if (!listeners.length) return undefined;
  const result: PointingData = { scrollLayers: [] };
  const invertX: boolean[] = [];
  const invertY: boolean[] = [];
  let unknownTransform = false;
  for (const listener of listeners) {
    const processors = cells(listener.body, 'input-processors') ?? '';
    const auto = processors.match(/&zip_temp_layer\s+(\d+)\b/);
    if (auto) result.autoMouseLayer = Number(auto[1]);
    for (const node of listener.children) {
      if (/status\s*=\s*"disabled"/.test(node.body)) continue;
      const pipeline = cells(node.body, 'input-processors') ?? '';
      if (!/&zip_xy_to_scroll_mapper\b/.test(pipeline)) continue;
      const layerCells = cells(node.body, 'layers');
      if (!layerCells || /[^\s<>\d]/.test(layerCells)) return undefined;
      result.scrollLayers.push(...(layerCells.match(/\d+/g) ?? []).map(Number));
      const transforms = [...pipeline.matchAll(/&zip_scroll_transform\s+([^&<>]*)/g)].map((m) => m[1]).join(' ');
      if (/\b(?:0x[\da-f]+|\d+)\b/i.test(transforms)) {
        unknownTransform = true; // 数値フラグの意味はヘッダ無しでは不明
        continue;
      }
      invertX.push(/\bINPUT_TRANSFORM_X_INVERT\b/.test(transforms));
      invertY.push(/\bINPUT_TRANSFORM_Y_INVERT\b/.test(transforms));
    }
  }
  result.scrollLayers = [...new Set(result.scrollLayers)];
  // レイヤーごとの設定が異なる軸は不明とする。
  if (!unknownTransform && invertX.length && invertX.every((v) => v === invertX[0])) result.scrollInvertX = invertX[0];
  if (!unknownTransform && invertY.length && invertY.every((v) => v === invertY[0])) result.scrollInvertY = invertY[0];
  return result;
}
