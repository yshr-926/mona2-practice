// クリアしたレッスンをブラウザに保存する。

const STORAGE_KEY = 'mona2-practice:progress:v1';

export function loadProgress(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function saveProgress(done: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch {
    // 保存できなくても進められる
  }
}
