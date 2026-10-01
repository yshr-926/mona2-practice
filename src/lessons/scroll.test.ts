import { expect, it } from 'bun:test';
import { bundledKeyboard } from '../lib/keymap-source.ts';
import { createKeymap } from '../lib/layout.ts';
import { buildLessons } from './index.ts';

it('スクロールレッスンは overlay のレイヤーと保持キーを使う', () => {
  const kb = { ...bundledKeyboard(), pointing: { scrollLayers: [1], scrollInvertX: false, scrollInvertY: true } };
  const lesson = buildLessons(createKeymap(kb)).find((l) => l.id === 'scroll')!;
  expect(lesson.view?.layer).toBe(1);
  expect(lesson.body).toContain('Space を押したまま');
});

it('overlay が不明のときだけ矢印レイヤーへフォールバックする', () => {
  const kb = { ...bundledKeyboard(), pointing: undefined };
  expect(buildLessons(createKeymap(kb)).find((l) => l.id === 'scroll')?.view?.layer).toBe(3);
  kb.pointing = undefined;
  const noScroll = { ...kb, pointing: { scrollLayers: [] } };
  expect(buildLessons(createKeymap(noScroll)).find((l) => l.id === 'scroll')?.view).toBeUndefined();
});
