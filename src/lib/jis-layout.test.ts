import { describe, expect, it } from 'bun:test';
import { JIS_LAYOUT, keycodeToChar, keycodeToCode, physicalKeyToChar, eventMatches } from './keycodes.ts';
import { createKeymap, tapKeycode } from './layout.ts';
import keyboard from '../data/keyboard.json';
import type { KeyboardData } from './zmk.ts';

describe('Mac JIS 配列', () => {
  it('通常、明示 Shift、暗黙 Shift を物理キーから解決する', () => {
    for (const [keycode, char] of Object.entries({
      LBKT: '@', AT_SIGN: '"', 'LS(N7)': "'", 'RS(N8)': '(', 'LS(N9)': ')', 'LS(N0)': '0',
      MINUS: '-', 'LS(MINUS)': '=', EQUAL: '^', PLUS: '~', 'LS(LBKT)': '`',
      RBKT: '[', 'LS(RBKT)': '{', BSLH: ']', PIPE: '}', SEMI: ';', COLON: '+',
      SQT: ':', DQT: '*', INT3: '¥', 'LS(INT3)': '|', INT1: '\\', 'RS(INT1)': '_',
      A: 'a', 'LS(A)': 'A', KP_N2: '2', COMMA: ',', 'LS(COMMA)': '<',
    })) expect(keycodeToChar(keycode, JIS_LAYOUT)).toBe(char);
    expect(physicalKeyToChar('Backquote', false, JIS_LAYOUT)).toBeUndefined();
  });

  it('練習の charMap が JIS の文字とイベントの key に一致し、code 判定も維持する', () => {
    const km = createKeymap(keyboard as KeyboardData, 0, JIS_LAYOUT);
    for (const char of ['@', '"', "'", '`', '^', ':', '*']) {
      const stroke = km.charMap.get(char)!;
      expect(stroke).toBeDefined();
      const keycode = tapKeycode(km.effective(stroke.layer, stroke.key))!;
      const code = keycodeToCode(keycode)!;
      const key = keycodeToChar(keycode, JIS_LAYOUT, stroke.shiftKey !== undefined)!;
      expect(key).toBe(char); // mountTyping の e.key === expected と同じ比較
      expect(eventMatches({ code, key } as KeyboardEvent, code)).toBe(true);
    }
  });
});
