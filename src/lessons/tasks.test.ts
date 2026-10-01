import { describe, expect, it } from 'bun:test';
import { bundledKeyboard } from '../lib/keymap-source.ts';
import { createKeymap } from '../lib/layout.ts';
import { parseKeymap } from '../lib/zmk.ts';
import { keyTest, keyTestConfirmation, press, type Task, type TaskCtx } from './tasks.ts';

// DOM 依存を最小限にして、自己申告ボタンと課題の完了を確かめる。
class Element {
  children: Element[] = [];
  textContent = '';
  innerHTML = '';
  hidden = false;
  onclick?: () => void;
  tag: string;
  constructor(tag: string) { this.tag = tag; }
  append(...children: Element[]) { this.children.push(...children); }
  replaceChildren(...children: Element[]) { this.children = children; }
}
function runTask(task: Task, codes: string[], test: (area: Element, completed: () => number, events: EventTarget) => void) {
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const controller = new AbortController();
  const events = new EventTarget();
  const area = new Element('div');
  let count = 0;
  const kb = structuredClone(bundledKeyboard());
  kb.layers[0].bindings = parseKeymap(`/ { keymap { compatible = "zmk,keymap"; base { bindings = <${codes.join(' ')}>; }; }; };`).layers[0].bindings;
  kb.keys = kb.keys.slice(0, codes.length);
  try {
    globalThis.document = { createElement: (tag: string) => new Element(tag) } as unknown as Document;
    globalThis.window = events as unknown as Window & typeof globalThis;
    task({ km: createKeymap(kb), area: area as unknown as HTMLElement, signal: controller.signal,
      complete: () => count++, setKeyboard: () => {} } satisfies TaskCtx);
    test(area, () => count, events);
  } finally {
    controller.abort();
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
  }
}
const buttons = (el: Element): Element[] => [ ...(el.tag === 'button' ? [el] : []), ...el.children.flatMap(buttons) ];

describe('ブラウザで確かめられないキーの自己申告', () => {
  it('未知マクロ・ビヘイビア・キーコードを含むキーマップで「押した」を出し、確認で完了する', () => {
    runTask(keyTest, ['&unknown_macro', '&unknown_behavior', '&kp UNKNOWN'], (area, completed) => {
      expect(completed()).toBe(0);
      expect(buttons(area).map((b) => b.textContent)).toEqual(['unknown_macro: 押した', 'unknown_behavior: 押した', 'UNKNOWN: 押した']);
      for (let i = 0; i < 3; i++) buttons(area)[0].onclick!();
      expect(completed()).toBe(1);
    });
  });

  it('システムショートカットを通常文字の keydown で誤確認しない', () => {
    runTask(keyTest, ['&kp LG(SPACE)'], (area, completed, events) => {
      events.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'Space', key: ' ' }));
      expect(completed()).toBe(0);
      expect(buttons(area)[0].textContent).toContain('Spotlight');
      buttons(area)[0].onclick!();
      expect(completed()).toBe(1);
    });
  });

  it('単キー課題でも自己申告で次の手順へ進む', () => {
    runTask(press([{ prompt: 'Spotlight', codes: ['Meta+Space'], view: { layer: 0 } }, { prompt: '未知キー', codes: [], view: { layer: 0 } }]), ['&kp A'], (area, completed) => {
      expect(buttons(area)[0].hidden).toBe(false);
      buttons(area)[0].onclick!();
      expect(buttons(area)[0].textContent).toBe('押した');
      buttons(area)[0].onclick!();
      expect(completed()).toBe(1);
      expect(buttons(area)[0].hidden).toBe(true);
    });
  });

  it('無効キーは除外し、検証できるキーには自己申告を出さない', () => {
    expect(keyTestConfirmation({ behavior: 'none', params: [] })).toBeUndefined();
    expect(keyTestConfirmation({ behavior: 'trans', params: [] })).toBeUndefined();
    expect(keyTestConfirmation({ behavior: 'kp', params: ['A'] })).toBeUndefined();
    expect(keyTestConfirmation({ behavior: 'custom_macro', params: [], def: { type: 'other', label: 'マクロ' } })).toBe('押した');
    runTask(press([{ prompt: 'A', codes: ['KeyA'], view: { layer: 0 } }]), ['&kp A'], (area) => {
      expect(buttons(area)[0].hidden).toBe(true);
    });
  });
});
