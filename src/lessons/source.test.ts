import { expect, it } from 'bun:test';
import { sourceGuidance } from './source.ts';
import { buildLessons } from './index.ts';
import { createKeymap } from '../lib/layout.ts';
import { bundledKeyboard, fromBundled, setCurrentKeymap } from '../lib/keymap-source.ts';

it('標準は作者のファイル、GitHub は読み込んだリポジトリとブランチを案内する', () => {
  expect(sourceGuidance({ kind: 'bundled' }).keymap).toContain('yshr-926/zmk-config-moNa2-v2/blob/main/config/mona2.keymap');
  const origin = { kind: 'github' as const, url: 'https://github.com/example/custom', owner: 'example', repo: 'custom', branch: 'my/layout', path: 'config/mona2.keymap' };
  const source = sourceGuidance(origin);
  expect(source.keymap).toContain('example/custom/blob/my%2Flayout/config/mona2.keymap');
  expect(source.overlay).toContain('example/custom/blob/my%2Flayout/boards/shields/mona2/mona2_r.overlay');
  const lesson = buildLessons(createKeymap(bundledKeyboard()), origin).find(l => l.id === 'customize')!;
  expect(lesson.body).toContain(source.keymap);
  expect(lesson.body).not.toContain('yshr-926');
});

it('ファイルと不明な出どころには作者リポジトリの前提を入れない', () => {
  const source = sourceGuidance({ kind: 'file', name: '<my>.keymap' });
  expect(source.keymap).toContain('読み込んだファイル (&#60;my&#62;.keymap)');
  expect(source.overlay).toContain('読み込んだファイルに対応する overlay');
  expect(JSON.stringify(source)).not.toContain('github.com');
  const unknown = sourceGuidance(undefined);
  expect(unknown.keymap).toContain('zmk-config');
  expect(unknown.overlay).toContain('https://zmk.dev/docs/');
  expect(JSON.stringify(unknown)).not.toContain('yshr-926');
  const lesson = buildLessons(createKeymap(bundledKeyboard()), null).find(l => l.id === 'customize')!;
  expect(lesson.body).toContain('https://zmk.dev/docs/config/keymap');
  expect(lesson.body).not.toContain('yshr-926');
});

it('省略時は currentOrigin のファイル出どころを使う', () => {
  const state = fromBundled();
  setCurrentKeymap({ ...state, origin: { kind: 'file', name: 'mine.keymap' } });
  try {
    expect(buildLessons(createKeymap(state.kb)).find(l => l.id === 'customize')!.body).toContain('mine.keymap');
  } finally {
    setCurrentKeymap(fromBundled());
  }
});
