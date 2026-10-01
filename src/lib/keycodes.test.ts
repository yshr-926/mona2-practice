import { describe, expect, it } from 'bun:test';
import { eventMatches, KEYCODE_CHAR, keycodeToChar, keycodeToCode, physicalKeyToChar, resolveKeycode, systemShortcut, US_LAYOUT } from './keycodes.ts';

describe('物理キーの解決', () => {
  it('記号の暗黙 Shift と修飾関数を同じ物理キーへ解決する', () => {
    expect(resolveKeycode('AT_SIGN')).toEqual({ code: 'Digit2', modifiers: ['LS'] });
    expect(resolveKeycode('LS(N1)')).toEqual({ code: 'Digit1', modifiers: ['LS'] });
    expect(resolveKeycode('RG(RA(RC(RS(N1))))')).toEqual({ code: 'Digit1', modifiers: ['RG', 'RA', 'RC', 'RS'] });
    expect(resolveKeycode('LC(LG(LS(AT_SIGN)))')).toEqual({ code: 'Digit2', modifiers: ['LC', 'LG', 'LS'] });
    expect(keycodeToCode('LG(LS(N4))')).toBe('Digit4');
  });

  it('国際キー、消費者キー、テンキーの物理 code を返す', () => {
    for (const [keycode, code] of Object.entries({
      INT1: 'IntlRo', INT_RO: 'IntlRo', INTERNATIONAL_3: 'IntlYen', INT3: 'IntlYen',
      NON_US_HASH: 'Backslash', NUBS: 'IntlBackslash', C_VOL_UP: 'AudioVolumeUp',
      C_VOLUME_DOWN: 'AudioVolumeDown', C_MUTE: 'AudioVolumeMute', C_PP: 'MediaPlayPause',
      C_NEXT: 'MediaTrackNext', C_PREV: 'MediaTrackPrevious', KP_N7: 'Numpad7',
      RIGHT_GUI: 'MetaRight', APOS: 'Quote',
    })) expect(keycodeToCode(keycode)).toBe(code);
  });

  it('不明な名前や壊れた修飾関数を受け付けない', () => {
    for (const code of ['UNKNOWN', 'LS(UNKNOWN)', 'LS(N1', 'XX(N1)', 'toString']) {
      expect(resolveKeycode(code)).toBeUndefined();
      expect(keycodeToChar(code)).toBeUndefined();
    }
  });
});

describe('配列表による文字の解決', () => {
  it('US の通常文字、Shift、暗黙 Shift を解決する', () => {
    expect(keycodeToChar('N1')).toBe('1');
    expect(keycodeToChar('LS(N1)')).toBe('!');
    expect(keycodeToChar('RS(N1)')).toBe('!');
    expect(keycodeToChar('AT_SIGN')).toBe('@');
    expect(keycodeToChar('LS(AT_SIGN)')).toBe('@');
    expect(keycodeToChar('A', US_LAYOUT, true)).toBe('A');
    expect(keycodeToChar('NON_US_HASH')).toBe('\\');
    expect(physicalKeyToChar('Digit2', true)).toBe('@');
    expect(KEYCODE_CHAR.AT_SIGN).toBe('@');
    expect(KEYCODE_CHAR.NON_US_HASH).toBe('\\');
  });

  it('US 表で国際キーや文字以外のキーは文字にしない', () => {
    for (const code of ['INT1', 'INT3', 'ENTER', 'C_VOL_UP', 'LC(A)', 'LA(A)', 'LG(LS(N4))']) {
      expect(keycodeToChar(code)).toBeUndefined();
    }
  });

  it('配列表を差し替えて同じ物理キーを別の文字にできる', () => {
    const layout = { ...US_LAYOUT, Digit2: ['2', '"'] as const, IntlYen: ['¥', '|'] as const };
    expect(keycodeToChar('AT_SIGN', layout)).toBe('"');
    expect(keycodeToChar('INT3', layout)).toBe('¥');
    expect(keycodeToChar('RS(INT3)', layout)).toBe('|');
  });

  it('イベントの物理キー判定と Lang の代替名を維持する', () => {
    expect(eventMatches({ code: 'Digit2', key: '@' } as KeyboardEvent, keycodeToCode('AT_SIGN')!)).toBe(true);
    expect(eventMatches({ code: '', key: 'Eisu' } as KeyboardEvent, 'Lang2')).toBe(true);
    expect(eventMatches({ code: 'KeyA', key: 'a' } as KeyboardEvent, 'Digit2')).toBe(false);
  });
});

describe('Mac とブラウザのショートカット', () => {
  it('追加した操作を正規化して照合する', () => {
    for (const key of ['LG(SPACE)', 'RG(TAB)', 'RC(SPACE)', 'F11', 'F14', 'F15',
      'RC(UP)', 'LC(DOWN)', 'RC(LEFT)', 'LC(RIGHT)', 'LG(Q)', 'LG(W)', 'RG(T)',
      'C_VOL_UP', 'C_VOLUME_DOWN', 'K_VOL_UP', 'C_MUTE', 'C_BRI_UP', 'C_BRIGHTNESS_DEC',
      'C_PLAY_PAUSE', 'C_PP', 'C_NEXT', 'C_PREVIOUS', 'C_STOP', 'C_EJECT']) {
      expect(systemShortcut(key)).toBeDefined();
    }
    for (const digit of [3, 4, 5]) {
      expect(systemShortcut(`RS(RG(NUMBER_${digit}))`)).toBe(systemShortcut(`LG(LS(N${digit}))`));
    }
    expect(systemShortcut(' LG( RS( DOLLAR ) ) ')).toBe(systemShortcut('LG(LS(N4))'));
    expect(systemShortcut('LC(LEFT)')).toBe(systemShortcut('RC(LEFT_ARROW)'));
  });

  it('修飾のない文字や別の修飾、不明なキーは一致させない', () => {
    for (const key of ['SPACE', 'TAB', 'N4', 'LS(N4)', 'LA(SPACE)', 'LG(LC(SPACE))', 'UNKNOWN', 'toString']) {
      expect(systemShortcut(key)).toBeUndefined();
    }
  });
});
