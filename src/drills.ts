// 練習用の出題セット。lines からランダムに選んで 1 行ずつ出す。

export type Drill = { id: string; title: string; description: string; lines: string[] };

const HOME = ['asdf jkl;', 'fjfj dkdk slsl a;a;', 'sad lad fall flask', 'ask a lass; add salad', 'jak dash glad flag'];

const WORDS = [
  'the quick brown fox jumps over the lazy dog',
  'practice makes perfect',
  'split keyboards reduce shoulder strain',
  'type slowly and accurately before going fast',
  'layer keys live under the thumbs',
  'hold space for numbers and brackets',
  'hold enter for symbols and function keys',
  'small steps every day add up',
];

const CAPS = ['Hello World', 'Tokyo Osaka Nagoya', 'TypeScript React Vite', 'GitHub ZMK Keymap', 'Zebra Zone Zigzag'];

const NUMBERS = ['2026 09 23', '3.14159 2.71828', '10 20 30 40 50', '192.168.0.1', '0123 4567 89', '1024 2048 4096'];

const SYMBOLS = [
  '! @ # $ % ^ & * - _',
  '( ) [ ] { } < >',
  '= + - * / % ;',
  '` ~ " \' | \\',
  'a != b && c || d',
  'x += 1; y -= 2;',
];

const CODE = [
  'const x = [1, 2, 3];',
  'if (a && b) { return; }',
  'function add(a, b) { return a + b; }',
  'git commit -m "fix: typo"',
  'ls -la ~/projects | grep mona2',
  'arr.map((x) => x * 2)',
  'obj["key"] = `value ${n}`;',
  'echo $HOME && cd ..',
];

export const DRILLS: Drill[] = [
  { id: 'home', title: 'ホームポジション', description: '中段だけ', lines: HOME },
  { id: 'words', title: '英文', description: '小文字 + スペース', lines: WORDS },
  { id: 'caps', title: '大文字', description: 'Shift', lines: CAPS },
  { id: 'numbers', title: '数字', description: '数字レイヤー', lines: NUMBERS },
  { id: 'symbols', title: '記号', description: '数字・マウスレイヤーの記号', lines: SYMBOLS },
  { id: 'code', title: 'コード', description: '全部入り', lines: CODE },
];

// canType で打てない文字を含む行を除く (キーマップによっては ' や " が無いため)
export function pickLine(drill: Drill, canType: (c: string) => boolean, prev?: string): string {
  const typable = drill.lines.filter((l) => [...l].every(canType));
  const pool = typable.length > 1 ? typable.filter((l) => l !== prev) : typable;
  return pool[Math.floor(Math.random() * pool.length)] ?? '';
}
