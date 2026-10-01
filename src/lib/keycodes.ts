// ZMK の物理キーと、OS 側の配列による文字解決を分けて扱う。

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
  KP_NUMBER_0: 'Numpad0',
  LANG1: 'Lang1', LANG2: 'Lang2',
  UP_ARROW: 'ArrowUp', UP: 'ArrowUp', DOWN_ARROW: 'ArrowDown', DOWN: 'ArrowDown',
  LEFT_ARROW: 'ArrowLeft', LEFT: 'ArrowLeft', RIGHT_ARROW: 'ArrowRight', RIGHT: 'ArrowRight',
  HOME: 'Home', END: 'End', PAGE_UP: 'PageUp', PG_UP: 'PageUp', PAGE_DOWN: 'PageDown', PG_DN: 'PageDown',
  PRINTSCREEN: 'PrintScreen', PRINT_SCREEN: 'PrintScreen',
  APOSTROPHE: 'Quote', APOS: 'Quote', RETURN: 'Enter',
  RIGHT_ALT: 'AltRight', RALT: 'AltRight', RIGHT_GUI: 'MetaRight', RGUI: 'MetaRight', RIGHT_WIN: 'MetaRight',
  CAPSLOCK: 'CapsLock', CAPS: 'CapsLock', INSERT: 'Insert', INS: 'Insert',
  PAUSE_BREAK: 'Pause', PAUSE: 'Pause', SCROLLLOCK: 'ScrollLock', SLCK: 'ScrollLock',
  NON_US_HASH: 'Backslash', NUHS: 'Backslash',
  NON_US_BACKSLASH: 'IntlBackslash', NON_US_BSLH: 'IntlBackslash', NUBS: 'IntlBackslash',
  INTERNATIONAL_1: 'IntlRo', INT1: 'IntlRo', INT_RO: 'IntlRo',
  INTERNATIONAL_2: 'KanaMode', INT2: 'KanaMode', INT_KANA: 'KanaMode', INT_KATAKANAHIRAGANA: 'KanaMode',
  INTERNATIONAL_3: 'IntlYen', INT3: 'IntlYen', INT_YEN: 'IntlYen',
  INTERNATIONAL_4: 'Convert', INT4: 'Convert', INT_HENKAN: 'Convert',
  INTERNATIONAL_5: 'NonConvert', INT5: 'NonConvert', INT_MUHENKAN: 'NonConvert',
  KP_PLUS: 'NumpadAdd', KP_MINUS: 'NumpadSubtract', KP_MULTIPLY: 'NumpadMultiply',
  KP_DIVIDE: 'NumpadDivide', KP_SLASH: 'NumpadDivide', KP_ASTERISK: 'NumpadMultiply', KP_SUBTRACT: 'NumpadSubtract',
  KP_ENTER: 'NumpadEnter', KP_DOT: 'NumpadDecimal', KP_EQUAL: 'NumpadEqual', KP_COMMA: 'NumpadComma',
  KP_NUMLOCK: 'NumLock', KP_NUM: 'NumLock', KP_NLCK: 'NumLock',
  K_MUTE: 'AudioVolumeMute', C_MUTE: 'AudioVolumeMute',
  K_VOLUME_UP: 'AudioVolumeUp', K_VOL_UP: 'AudioVolumeUp', C_VOLUME_UP: 'AudioVolumeUp', C_VOL_UP: 'AudioVolumeUp',
  K_VOLUME_DOWN: 'AudioVolumeDown', K_VOL_DN: 'AudioVolumeDown', C_VOLUME_DOWN: 'AudioVolumeDown', C_VOL_DN: 'AudioVolumeDown',
  C_PLAY: 'MediaPlay', C_PAUSE: 'MediaPause', C_PLAY_PAUSE: 'MediaPlayPause', C_PP: 'MediaPlayPause',
  C_STOP: 'MediaStop', C_NEXT: 'MediaTrackNext', C_PREVIOUS: 'MediaTrackPrevious', C_PREV: 'MediaTrackPrevious',
  C_EJECT: 'Eject',
  C_BRIGHTNESS_INC: 'BrightnessUp', C_BRI_INC: 'BrightnessUp', C_BRI_UP: 'BrightnessUp',
  C_BRIGHTNESS_DEC: 'BrightnessDown', C_BRI_DEC: 'BrightnessDown', C_BRI_DN: 'BrightnessDown',
};

// 修飾関数は左右を保持する。文字解決では左右どちらの Shift も同じ扱い。
export type Modifier = 'LS' | 'RS' | 'LC' | 'RC' | 'LA' | 'RA' | 'LG' | 'RG';
export type PhysicalKey = { code: string; modifiers: Modifier[] };

const SYMBOL_KEYS: Record<string, string[]> = {
  Digit1: ['EXCLAMATION', 'EXCL'], Digit2: ['AT_SIGN', 'AT'],
  Digit3: ['POUND', 'HASH'], Digit4: ['DOLLAR', 'DLLR'],
  Digit5: ['PERCENT', 'PRCNT'], Digit6: ['CARET'],
  Digit7: ['AMPERSAND', 'AMPS'], Digit8: ['ASTERISK', 'ASTRK', 'STAR'],
  Digit9: ['LEFT_PARENTHESIS', 'LPAR'], Digit0: ['RIGHT_PARENTHESIS', 'RPAR'],
  Minus: ['UNDERSCORE', 'UNDER'], Equal: ['PLUS'],
  BracketLeft: ['LEFT_BRACE', 'LBRC'], BracketRight: ['RIGHT_BRACE', 'RBRC'],
  Backslash: ['PIPE', 'TILDE2'], Semicolon: ['COLON'], Quote: ['DOUBLE_QUOTES', 'DQT'],
  Comma: ['LESS_THAN', 'LT'], Period: ['GREATER_THAN', 'GT'],
  Slash: ['QUESTION', 'QMARK'], Backquote: ['TILDE'],
  IntlBackslash: ['PIPE2'],
};
const IMPLICIT_SHIFT = Object.fromEntries(
  Object.entries(SYMBOL_KEYS).flatMap(([code, aliases]) => aliases.map((alias) => [alias, code])),
);

// 1 段目: ZMK キーコードを配列に依存しない物理キーと暗黙の修飾へ分解する。
export function resolveKeycode(keycode: string): PhysicalKey | undefined {
  const name = keycode.trim();
  const match = name.match(/^(LS|RS|LC|RC|LA|RA|LG|RG)\(\s*(.*?)\s*\)$/);
  if (match) {
    const inner = resolveKeycode(match[2]);
    if (!inner) return undefined;
    return { code: inner.code, modifiers: [...new Set([match[1] as Modifier, ...inner.modifiers])] };
  }
  if (Object.hasOwn(IMPLICIT_SHIFT, name)) return { code: IMPLICIT_SHIFT[name], modifiers: ['LS'] };
  const number = name.match(/^(?:N|NUMBER_)(\d)$/);
  const keypad = name.match(/^(?:KP_N|KP_NUMBER_)(\d)$/);
  const code = /^[A-Z]$/.test(name) ? `Key${name}`
    : number ? `Digit${number[1]}`
    : keypad ? `Numpad${keypad[1]}`
    : /^F(?:[1-9]|1\d|2[0-4])$/.test(name) ? name
    : Object.hasOwn(CODE_TABLE, name) ? CODE_TABLE[name] : undefined;
  return code ? { code, modifiers: [] } : undefined;
}

// 既存の物理キー判定も同じ分解処理を使う。
export function keycodeToCode(keycode: string): string | undefined {
  return resolveKeycode(keycode)?.code;
}

// 2 段目: OS 側の配列表。各物理キーに [通常, Shift] の文字を持つ。
export type KeyboardLayout = Readonly<Record<string, readonly [string, string]>>;
export const US_LAYOUT: KeyboardLayout = {
  ...Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [`Key${c}`, [c.toLowerCase(), c]])),
  ...Object.fromEntries('1234567890'.split('').map((c, i) => [`Digit${c}`, [c, '!@#$%^&*()'[i]]])),
  Space: [' ', ' '], Minus: ['-', '_'], Equal: ['=', '+'],
  BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
  Semicolon: [';', ':'], Quote: ["'", '"'], Comma: [',', '<'],
  Period: ['.', '>'], Slash: ['/', '?'], Backquote: ['`', '~'],
  IntlBackslash: ['\\', '|'],
  // IntlRo / IntlYen は US 表では未定義。JIS などの配列表で文字を定義する。
  ...Object.fromEntries('0123456789'.split('').map((c) => [`Numpad${c}`, [c, c]])),
  NumpadAdd: ['+', '+'], NumpadSubtract: ['-', '-'], NumpadMultiply: ['*', '*'],
  NumpadDivide: ['/', '/'], NumpadDecimal: ['.', '.'], NumpadEqual: ['=', '='], NumpadComma: [',', ','],
};

// Mac の JIS 英数入力。JIS にない US 専用キーは文字候補に含めない。
const { Backquote: _backquote, IntlBackslash: _intlBackslash, ...JIS_COMMON } = US_LAYOUT;
export const JIS_LAYOUT: KeyboardLayout = {
  ...JIS_COMMON,
  ...Object.fromEntries('1234567890'.split('').map((c, i) => [`Digit${c}`, [c, '!"#$%&\'()0'[i]]])),
  Minus: ['-', '='], Equal: ['^', '~'],
  BracketLeft: ['@', '`'], BracketRight: ['[', '{'], Backslash: [']', '}'],
  Semicolon: [';', '+'], Quote: [':', '*'],
  // Apple の日本語入力設定では「¥ キーで入力する文字」を変更できる。
  // この表はキー刻印に合わせて ¥ を既定とする (\ は IntlRo から入力)。
  // https://support.apple.com/guide/japanese-input-method/jpim662a12b9/mac
  IntlYen: ['¥', '|'], IntlRo: ['\\', '_'],
};

export function physicalKeyToChar(code: string, shift = false, layout: KeyboardLayout = US_LAYOUT): string | undefined {
  return Object.hasOwn(layout, code) ? layout[code]?.[shift ? 1 : 0] : undefined;
}

// Ctrl / Option / Cmd は単なる文字入力ではないため、文字候補には含めない。
export function keycodeToChar(keycode: string, layout: KeyboardLayout = US_LAYOUT, shift = false): string | undefined {
  const physical = resolveKeycode(keycode);
  if (!physical || physical.modifiers.some((m) => m !== 'LS' && m !== 'RS')) return undefined;
  return physicalKeyToChar(physical.code, shift || physical.modifiers.length > 0, layout);
}

// 旧 API の互換表も同じ 2 段の解決から生成する。
export const KEYCODE_CHAR: Record<string, string> = Object.fromEntries(
  [...Object.keys(CODE_TABLE), ...Object.keys(IMPLICIT_SHIFT),
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    ...'0123456789'.split('').flatMap((n) => [`N${n}`, `NUMBER_${n}`, `KP_N${n}`, `KP_NUMBER_${n}`])]
    .flatMap((name) => {
      const char = keycodeToChar(name);
      return char === undefined ? [] : [[name, char]];
    }),
);
export const SHIFTED: Record<string, string> = Object.fromEntries(
  Object.values(US_LAYOUT).filter(([plain, shifted]) => plain !== shifted),
);

// Safari など Lang1/Lang2 を code で返さないブラウザ向けに key 側でも拾う
const KEY_ALIASES: Record<string, string[]> = {
  Lang1: ['KanaMode', 'Lang1', 'HangulMode'],
  Lang2: ['Eisu', 'Alphanumeric', 'Lang2', 'HanjaMode'],
};

export function eventMatches(e: KeyboardEvent, code: string): boolean {
  return e.code === code || (KEY_ALIASES[code]?.includes(e.key) ?? false);
}

// macOS やブラウザが先に受け取る操作。戻ってきてから変化を自己申告してもらう。
export const SYSTEM_SHORTCUTS: Record<string, string> = {
  F11: 'デスクトップが表示された',
  F14: '画面が暗くなった',
  F15: '画面が明るくなった',
  'LC(LEFT_ARROW)': '左のデスクトップに移動した',
  'LC(RIGHT_ARROW)': '右のデスクトップに移動した',
  'LC(UP_ARROW)': 'Mission Control が開いた',
  'LC(DOWN_ARROW)': 'アプリのウインドウ一覧が開いた',
  'LG(SPACE)': 'Spotlight が開いた',
  'LG(TAB)': 'アプリを切り替えた',
  'LC(SPACE)': '入力ソースを切り替えた',
  'LG(LS(N3))': 'スクリーンショットを撮った',
  'LG(LS(N4))': 'スクリーンショットの範囲選択が始まった',
  'LG(LS(N5))': 'スクリーンショットの操作パネルが開いた',
  'LG(Q)': 'アプリを終了した (再度開いて確認)',
  'LG(W)': 'タブやウインドウを閉じた (戻って確認)',
  'LG(T)': '新しいタブが開いた',
  'LG(N)': '新しいウインドウが開いた',
  'LG(L)': 'アドレスバーが選択された',
  'LG(R)': 'ページを再読み込みした',
  'LG(H)': 'アプリが隠れた (戻って確認)',
  'LG(LS(T))': '閉じたタブが開いた',
  'LG(LS(N))': 'プライベートウインドウが開いた',
  C_VOL_UP: '音量が上がった', C_VOL_DN: '音量が下がった', C_MUTE: '消音を切り替えた',
  C_BRI_UP: '画面が明るくなった', C_BRI_DN: '画面が暗くなった',
  C_PLAY_PAUSE: '再生・一時停止を切り替えた', C_PLAY: '再生した', C_PAUSE: '一時停止した',
  C_STOP: '再生を停止した', C_NEXT: '次の曲に移った', C_PREV: '前の曲に移った', C_EJECT: '取り出しを操作した',
};

// 左右や修飾の順序、キーコードの別名を同じ署名へ正規化する。
function shortcutSignature(key: PhysicalKey): string {
  const mods = [...new Set(key.modifiers.map((m) => m.slice(1)))].sort();
  return [...mods, key.code].join('+');
}
const normalizedShortcuts = new Map(
  Object.entries(SYSTEM_SHORTCUTS).map(([key, label]) => [shortcutSignature(resolveKeycode(key)!), label]),
);

export function systemShortcut(keycode: string | PhysicalKey): string | undefined {
  const key = typeof keycode === 'string' ? resolveKeycode(keycode) : keycode;
  return key ? normalizedShortcuts.get(shortcutSignature(key)) : undefined;
}
