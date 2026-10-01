// ZMK のキーコード名 → US 配列で入力される文字。
// ZMK の記号系キーコード (EXCLAMATION など) は暗黙に Shift を含むので、出力文字を直接持つ。

const LETTERS = Object.fromEntries(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [c, c.toLowerCase()]),
);

const NUMBERS = Object.fromEntries(
  '0123456789'.split('').flatMap((d) => [
    [`N${d}`, d],
    [`NUMBER_${d}`, d],
  ]),
);

export const KEYCODE_CHAR: Record<string, string> = {
  ...LETTERS,
  ...NUMBERS,
  SPACE: ' ',
  SEMICOLON: ';', SEMI: ';',
  COLON: ':',
  COMMA: ',', LESS_THAN: '<', LT: '<',
  DOT: '.', PERIOD: '.', GREATER_THAN: '>', GT: '>',
  SLASH: '/', FSLH: '/', QUESTION: '?', QMARK: '?',
  MINUS: '-', UNDERSCORE: '_', UNDER: '_',
  EQUAL: '=', PLUS: '+',
  LEFT_BRACKET: '[', LBKT: '[', RIGHT_BRACKET: ']', RBKT: ']',
  LEFT_BRACE: '{', LBRC: '{', RIGHT_BRACE: '}', RBRC: '}',
  LEFT_PARENTHESIS: '(', LPAR: '(', RIGHT_PARENTHESIS: ')', RPAR: ')',
  BACKSLASH: '\\', BSLH: '\\', PIPE: '|',
  GRAVE: '`', TILDE: '~',
  SINGLE_QUOTE: "'", SQT: "'", APOSTROPHE: "'", APOS: "'",
  DOUBLE_QUOTES: '"', DQT: '"',
  EXCLAMATION: '!', EXCL: '!',
  AT_SIGN: '@', AT: '@',
  POUND: '#', HASH: '#',
  DOLLAR: '$', DLLR: '$',
  PERCENT: '%', PRCNT: '%',
  CARET: '^',
  AMPERSAND: '&', AMPS: '&',
  ASTERISK: '*', ASTRK: '*', STAR: '*',
};

// US 配列で Shift を押したときの文字
export const SHIFTED: Record<string, string> = {
  ...Object.fromEntries('abcdefghijklmnopqrstuvwxyz'.split('').map((c) => [c, c.toUpperCase()])),
  '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
  '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?', '`': '~',
};

const SHORT_LABELS: Record<string, string> = {
  BACKSPACE: 'BS', BSPC: 'BS', ENTER: 'Enter', RET: 'Enter', SPACE: 'Space', TAB: 'Tab', ESC: 'Esc', ESCAPE: 'Esc',
  LEFT_SHIFT: 'Shift', LSHFT: 'Shift', RIGHT_SHIFT: 'Shift', RSHFT: 'Shift',
  LCTRL: 'Ctrl', LEFT_CONTROL: 'Ctrl', RCTRL: 'Ctrl', RIGHT_CONTROL: 'Ctrl',
  LEFT_WIN: 'Cmd', LGUI: 'Cmd', LEFT_GUI: 'Cmd', KP_NUMBER_0: '0',
  LEFT_ALT: 'Opt', LALT: 'Opt', LANG1: 'かな', LANG2: '英数', DELETE: 'Del', DEL: 'Del',
  UP_ARROW: '↑', UP: '↑', DOWN_ARROW: '↓', DOWN: '↓', LEFT_ARROW: '←', LEFT: '←', RIGHT_ARROW: '→', RIGHT: '→',
  PAGE_UP: 'PgUp', PAGE_DOWN: 'PgDn', HOME: 'Home', END: 'End', PRINTSCREEN: 'PrtSc',
  C_VOL_UP: 'Vol+', C_VOL_DN: 'Vol-',
};

// 修飾キー付きは Mac の記号で短く書く (⌃ Ctrl / ⇧ Shift / ⌥ Option / ⌘ Cmd)
const MOD_FUNCS: Record<string, string> = { LC: '⌃', LS: '⇧', LA: '⌥', LG: '⌘', RC: '⌃', RS: '⇧', RA: '⌥', RG: '⌘' };

export function keycodeLabel(code: string): string {
  const m = code.match(/^(\w+)\((.*)\)$/);
  if (m && MOD_FUNCS[m[1]]) return `${MOD_FUNCS[m[1]]}${keycodeLabel(m[2])}`;
  return SHORT_LABELS[code] ?? KEYCODE_CHAR[code]?.toUpperCase() ?? code;
}

// ZMK のキーコード名 → KeyboardEvent.code。IME や入力ソースに左右されずに物理的な出力を判定できる。
const CODE_TABLE: Record<string, string> = {
  SPACE: 'Space', ENTER: 'Enter', RET: 'Enter', BACKSPACE: 'Backspace', BSPC: 'Backspace',
  TAB: 'Tab', ESC: 'Escape', ESCAPE: 'Escape', DELETE: 'Delete', DEL: 'Delete',
  SEMICOLON: 'Semicolon', SEMI: 'Semicolon', COMMA: 'Comma', DOT: 'Period', PERIOD: 'Period',
  SLASH: 'Slash', FSLH: 'Slash', MINUS: 'Minus', EQUAL: 'Equal',
  LEFT_BRACKET: 'BracketLeft', LBKT: 'BracketLeft', RIGHT_BRACKET: 'BracketRight', RBKT: 'BracketRight',
  BACKSLASH: 'Backslash', BSLH: 'Backslash', GRAVE: 'Backquote', SQT: 'Quote', SINGLE_QUOTE: 'Quote',
  LCTRL: 'ControlLeft', LEFT_CONTROL: 'ControlLeft', LEFT_WIN: 'MetaLeft', LGUI: 'MetaLeft', LEFT_GUI: 'MetaLeft',
  LEFT_ALT: 'AltLeft', LALT: 'AltLeft', LEFT_SHIFT: 'ShiftLeft', LSHFT: 'ShiftLeft',
  RIGHT_SHIFT: 'ShiftRight', RSHFT: 'ShiftRight', RCTRL: 'ControlRight', RIGHT_CONTROL: 'ControlRight',
  KP_NUMBER_0: 'Numpad0', COLON: 'Semicolon',
  LANG1: 'Lang1', LANG2: 'Lang2',
  UP_ARROW: 'ArrowUp', UP: 'ArrowUp', DOWN_ARROW: 'ArrowDown', DOWN: 'ArrowDown',
  LEFT_ARROW: 'ArrowLeft', LEFT: 'ArrowLeft', RIGHT_ARROW: 'ArrowRight', RIGHT: 'ArrowRight',
  HOME: 'Home', END: 'End', PAGE_UP: 'PageUp', PG_UP: 'PageUp', PAGE_DOWN: 'PageDown', PG_DN: 'PageDown',
  PRINTSCREEN: 'PrintScreen',
};

export function keycodeToCode(code: string): string | undefined {
  if (/^[A-Z]$/.test(code)) return `Key${code}`;
  const num = code.match(/^(?:N|NUMBER_)(\d)$/);
  if (num) return `Digit${num[1]}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return CODE_TABLE[code];
}

// Safari など Lang1/Lang2 を code で返さないブラウザ向けに key 側でも拾う
const KEY_ALIASES: Record<string, string[]> = {
  Lang1: ['KanaMode', 'Lang1', 'HangulMode'],
  Lang2: ['Eisu', 'Alphanumeric', 'Lang2', 'HanjaMode'],
};

export function eventMatches(e: KeyboardEvent, code: string): boolean {
  return e.code === code || (KEY_ALIASES[code]?.includes(e.key) ?? false);
}

// macOS が先に受け取ってしまい、ブラウザ (アプリ) には届かないキー → 画面で確かめられる変化。
// 全キーテストやレッスンでは、この変化を見て自己申告してもらう
export const SYSTEM_SHORTCUTS: Record<string, string> = {
  F14: '画面が暗くなった',
  F15: '画面が明るくなった',
  'LC(LEFT_ARROW)': '左のデスクトップに移動した',
  'LC(RIGHT_ARROW)': '右のデスクトップに移動した',
  'LC(UP_ARROW)': 'Mission Control が開いた',
};
