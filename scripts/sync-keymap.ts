// zmk-config-moNa2-v2 のキーマップと物理レイアウトを src/data/keyboard.json に書き出す。
// これがアプリ同梱の「標準のキーマップ」になる (利用者が読み込むキーマップは src/lib/keymap-source.ts が実行時に扱う)。
// 使い方: bun run sync-keymap [<zmk-config のパス>]
//   パス省略時は ZMK_CONFIG_DIR、それも無ければ ~/zmk-config-moNa2-v2

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseOverlay } from '../src/lib/overlay.ts';
import { parseKeymap, parsePhysicalLayout, type KeyboardData } from '../src/lib/zmk.ts';

const configDir = resolve(process.argv[2] ?? process.env.ZMK_CONFIG_DIR ?? join(homedir(), 'zmk-config-moNa2-v2'));
const keymapPath = join(configDir, 'config/mona2.keymap');
const dtsiPath = join(configDir, 'boards/shields/mona2/mona2.dtsi');

const keymapText = readFileSync(keymapPath, 'utf8');
const { layers, combos, conditionalLayers } = parseKeymap(keymapText);
const overlayPath = join(configDir, 'boards/shields/mona2/mona2_r.overlay');
const pointing = existsSync(overlayPath) ? parseOverlay(readFileSync(overlayPath, 'utf8'), keymapText) : undefined;
const keys = parsePhysicalLayout(readFileSync(dtsiPath, 'utf8'));

for (const layer of layers) {
  if (layer.bindings.length !== keys.length) {
    throw new Error(`layer "${layer.name}" has ${layer.bindings.length} bindings, expected ${keys.length}`);
  }
}

const data: KeyboardData = {
  source: configDir.replace(homedir(), '~'),
  syncedAt: new Date().toISOString(),
  keys,
  layers,
  combos,
  pointing,
  ...(conditionalLayers.length ? { conditionalLayers } : {}),
};

const out = new URL('../src/data/keyboard.json', import.meta.url);
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`synced ${layers.length} layers, ${keys.length} keys, ${combos.length} combos from ${configDir}`);
