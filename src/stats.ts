// 文字ごとのミス数・打鍵数をブラウザに保存する。

const STORAGE_KEY = 'mona2-practice:stats:v1';

export type CharStats = Record<string, { hits: number; misses: number }>;

export function loadStats(): CharStats {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveStats(stats: CharStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // 保存できなくても練習は続けられる
  }
}

export function record(stats: CharStats, char: string, ok: boolean): void {
  const s = (stats[char] ??= { hits: 0, misses: 0 });
  if (ok) s.hits++;
  else s.misses++;
}

export function weakest(stats: CharStats, n: number): { char: string; rate: number; misses: number }[] {
  return Object.entries(stats)
    .filter(([, s]) => s.misses > 0)
    .map(([char, s]) => ({ char, misses: s.misses, rate: s.misses / (s.hits + s.misses) }))
    .sort((a, b) => b.rate - a.rate || b.misses - a.misses)
    .slice(0, n);
}
