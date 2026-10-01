// 画面下の「入力モニター」。最後に届いたキー・クリック・ホイールを常に表示して、
// 「押したのに反応しない」のか「別のものが届いている」のかを切り分けられるようにする。

const BUTTONS = ['左クリック', '中クリック', '右クリック', '戻る', '進む'];

export function startMonitor(el: HTMLElement): void {
  const cells = {
    key: document.createElement('span'),
    mouse: document.createElement('span'),
    wheel: document.createElement('span'),
    ime: document.createElement('span'),
  };
  el.replaceChildren(
    label('キー', cells.key),
    label('マウス', cells.mouse),
    label('ホイール', cells.wheel),
    label('IME', cells.ime),
  );
  cells.key.textContent = cells.mouse.textContent = cells.wheel.textContent = '—';
  cells.ime.textContent = '—';

  window.addEventListener(
    'keydown',
    (e) => {
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Cmd'].filter(Boolean);
      const key = e.key === ' ' ? 'Space' : e.key;
      cells.key.textContent = `${[...mods, e.code || '(なし)'].join('+')}  →  "${key}"`;
      const composing = e.isComposing || e.key === 'Process' || e.keyCode === 229;
      cells.ime.textContent = composing ? 'かな入力中 (英数キーで戻す)' : '英数';
      cells.ime.className = composing ? 'warn' : '';
    },
    true,
  );
  window.addEventListener('mousedown', (e) => (cells.mouse.textContent = BUTTONS[e.button] ?? `button ${e.button}`), true);
  window.addEventListener(
    'wheel',
    (e) => {
      const dir = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? (e.deltaY > 0 ? '下' : '上') : e.deltaX > 0 ? '右' : '左';
      cells.wheel.textContent = `${dir} (${Math.round(e.deltaX)}, ${Math.round(e.deltaY)})`;
    },
    { capture: true, passive: true },
  );
}

function label(name: string, value: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = name;
  wrap.append(b, value);
  return wrap;
}
