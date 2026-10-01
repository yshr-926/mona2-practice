// レッスンの「課題」部分。どれも入力イベントを見て、条件を満たしたら ctx.complete() を呼ぶ。

import type { Keymap } from '../lib/layout.ts';
import { bindingLabel, expectedCodes, tapKeycode } from '../lib/layout.ts';
import { KEYCODE_CHAR, SYSTEM_SHORTCUTS, eventMatches, keycodeToCode } from '../lib/keycodes.ts';
import type { KeyboardView, Mark } from '../ui/keyboard.ts';
import { h } from '../ui/dom.ts';
import { mountTyping } from '../ui/typing.ts';

export type TaskCtx = {
  km: Keymap;
  area: HTMLElement;
  signal: AbortSignal;
  setKeyboard: (view: KeyboardView | null) => void;
  complete: () => void;
};

// missing: 押すキーが今のキーマップに無くて課題ができないときの理由 (課題を作るときに分かるもの)
// lines: 文字入力の課題で打たせる行 (打てるかどうかはキーマップ次第なので missingIn で確かめる)
export type Task = ((ctx: TaskCtx) => void) & { missing?: string; lines?: string[] };

const NOT_IN_KEYMAP = 'このキーマップにはありません';

// 押すキーが見つからなかった表示 (lessons/index.ts の view() が missing を付ける)
const lacks = (view: KeyboardView | undefined) => !view || !!view.missing;

// 行の文字が全部、今のキーマップで打てるか
export const canType = (km: Keymap, line: string) => [...line].every((c) => km.charMap.has(c));

/** このキーマップでは課題ができないとき、その理由 */
export function missingIn(km: Keymap, task: Task): string | undefined {
  if (task.missing) return task.missing;
  if (task.lines && !task.lines.some((l) => canType(km, l))) {
    const chars = [...new Set(task.lines.flatMap((l) => [...l]))].filter((c) => !km.charMap.has(c));
    return `この課題で打つ文字 (${chars.join(' ')}) が、このキーマップでは打てません。`;
  }
  return undefined;
}

const on = <K extends keyof WindowEventMap>(ctx: TaskCtx, type: K, fn: (e: WindowEventMap[K]) => void, passive = true) =>
  window.addEventListener(type, fn, { signal: ctx.signal, passive });

// ---- 読むだけ ----

export const read =
  (label = '読みました'): Task =>
  (ctx) => {
    ctx.area.append(h('button', { className: 'primary', textContent: label, onclick: () => ctx.complete() }));
  };

// ---- 何かキーが届けば OK ----

export const anyKey: Task = (ctx) => {
  const msg = h('p', { className: 'waiting', textContent: 'moNa2 のどれかのキーを押してください…' });
  ctx.area.append(msg);
  const done = () => {
    msg.className = 'ok';
    msg.textContent = '入力が届きました。接続 OK です。';
    ctx.complete();
  };
  on(ctx, 'keydown', done);
  on(ctx, 'mousemove', (e) => {
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 30) done();
  });
};

// ---- 指定のキーを順番に押す ----

// 'Meta+Shift+KeyZ' のような指定。修飾キーは「押されていること」だけ見る
function matchSpec(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.split('+');
  const code = parts.pop()!;
  const mods = { Meta: e.metaKey, Ctrl: e.ctrlKey, Alt: e.altKey, Shift: e.shiftKey } as Record<string, boolean>;
  return eventMatches(e, code) && parts.every((m) => mods[m]);
}

// レイヤーキーのつもりが「短く押した」扱いになったときの説明。キーマップのレイヤーキーから作る
function tapHint(km: Keymap, e: KeyboardEvent): string {
  const pos = [...km.layerKeys.values()].find((p) => keycodeToCode(tapKeycode(km.kb.layers[km.base].bindings[p]) ?? '') === e.code);
  if (pos === undefined) return '';
  const label = bindingLabel(km.kb.layers[km.base].bindings[pos]).tap;
  return `<br>「${label}」キーが「短く押した」扱いになりました。${label} をしっかり押さえたまま、次のキーを押してください。`;
}

export type PressStep = { prompt: string; codes: string[]; view?: KeyboardView };

// 手順の一覧。キーが見つからなかった手順は「このキーマップにはありません」として飛ばす
function stepItems(steps: { prompt: string; view?: KeyboardView }[], i: number) {
  return steps.map((s, j) => {
    const li = h('li', { className: lacks(s.view) ? 'skip' : j < i ? 'ok' : j === i ? 'current' : '' });
    li.innerHTML = lacks(s.view) ? `${s.prompt} — ${NOT_IN_KEYMAP}` : s.prompt;
    return li;
  });
}

const allLack = (steps: { view?: KeyboardView }[]) => (steps.every((s) => lacks(s.view)) ? `この課題で押すキーが、${NOT_IN_KEYMAP}。` : undefined);

export const press = (steps: PressStep[]): Task =>
  Object.assign(
    (ctx: TaskCtx) => {
      const list = h('ol', { className: 'steps' });
      const feedback = h('p', { className: 'feedback' });
      ctx.area.append(list, feedback);
      let i = 0;
      const skip = () => {
        while (i < steps.length && lacks(steps[i].view)) i++;
      };

      const render = () => {
        list.replaceChildren(...stepItems(steps, i));
        if (i < steps.length) ctx.setKeyboard(steps[i].view ?? null);
      };

      on(
        ctx,
        'keydown',
        (e) => {
          if (i >= steps.length) return;
          if (steps[i].codes.some((c) => matchSpec(e, c))) {
            e.preventDefault();
            i++;
            skip();
            feedback.textContent = '';
            render();
            if (i === steps.length) ctx.complete();
            return;
          }
          if (['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return; // 修飾キー単体は途中経過
          const mods = [e.metaKey && 'Cmd', e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
          feedback.innerHTML = `今届いたのは「${[...mods, e.code || e.key].join(' + ')}」です。${tapHint(ctx.km, e)}`;
        },
        false,
      );
      skip();
      render();
      if (i === steps.length) ctx.complete();
    },
    { missing: allLack(steps) },
  );

// ---- Mac が受け取る操作 (デスクトップの切り替えなど) を、画面を見て確認する ----
// ブラウザには何も届かないので、押して画面が変わったら「できた」を押してもらう

export type ConfirmStep = { prompt: string; done: string; view?: KeyboardView };

export const confirmSteps = (steps: ConfirmStep[]): Task =>
  Object.assign(
    (ctx: TaskCtx) => {
      const list = h('ol', { className: 'steps' });
      const button = h('button', { className: 'primary' });
      ctx.area.append(list, button);
      let i = 0;
      const skip = () => {
        while (i < steps.length && lacks(steps[i].view)) i++;
      };
      const render = () => {
        list.replaceChildren(...stepItems(steps, i));
        if (i < steps.length) {
          button.textContent = steps[i].done;
          ctx.setKeyboard(steps[i].view ?? null);
        } else button.remove();
      };
      button.onclick = () => {
        i++;
        skip();
        render();
        if (i === steps.length) ctx.complete();
      };
      skip();
      render();
      if (i === steps.length) ctx.complete();
    },
    { missing: allLack(steps) },
  );

// ---- 全キーの動作確認 ----

export const keyTest: Task = (ctx) => {
  const { kb, base } = ctx.km;
  const bindings = kb.layers[base].bindings;
  const codesOf = bindings.map(expectedCodes);
  // Mac が先に受け取るキーは keydown が来ないので、画面の変化を見て自己申告してもらう
  const systemOf = bindings.map((b) => SYSTEM_SHORTCUTS[tapKeycode(b) ?? '']);
  const state = codesOf.map((c, pos) => (c.length || systemOf[pos] ? 'pending' : 'skip')) as ('pending' | 'ok' | 'skip')[];
  const mid = (Math.min(...kb.keys.map((k) => k.x)) + Math.max(...kb.keys.map((k) => k.x))) / 2;
  const isLeft = (pos: number) => kb.keys[pos].x < mid;
  let last = -1;

  const name = (pos: number) => {
    const { tap, hold } = bindingLabel(bindings[pos]);
    return hold ? `${tap}/${hold}` : tap;
  };

  // 同じ入力を送るキーが複数ある (Cmd が 2 つ、など) とどちらを押したか区別できないので、回数で数える。
  // ; と : のように code が同じでも出る文字が違えば e.key で区別できる
  const charOf = (pos: number) => KEYCODE_CHAR[tapKeycode(bindings[pos]) ?? ''];
  const shared = new Map<string, number[]>();
  codesOf.forEach((codes, pos) => {
    const sig = `${codes[0]}|${charOf(pos) ?? ''}`;
    if (codes[0]) shared.set(sig, [...(shared.get(sig) ?? []), pos]);
  });
  const groups = [...shared.values()].filter((g) => g.length > 1);

  const summary = h('p', { className: 'feedback' });
  const diagnosis = h('div', { className: 'diagnosis' });
  const skipList = h('div', { className: 'skip-list' });
  ctx.area.append(summary, diagnosis, skipList);
  if (groups.length) {
    ctx.area.append(
      h('p', {
        className: 'feedback',
        textContent: `※ ${groups.map((g) => g.map(name).join(' と ')).join('、')} はそれぞれ同じ入力を送るので、どちらを押したかは区別できません。両方押してください。`,
      }),
    );
  }

  const render = () => {
    const marks = new Map<number, Mark>();
    state.forEach((s, pos) => s !== 'pending' && marks.set(pos, s === 'ok' ? 'ok' : 'skip'));
    if (last >= 0) marks.set(last, 'target');
    ctx.setKeyboard({ layer: base, marks, caption: '緑 = 反応した / 灰 = スキップ / 青 = 今押したキー' });

    const pending = state.flatMap((s, pos) => (s === 'pending' ? [pos] : []));
    const okCount = state.filter((s) => s === 'ok').length;
    summary.textContent = `${okCount} / ${state.length} キー確認済み (残り ${pending.length})`;

    const osKeys = pending.filter((pos) => systemOf[pos]);
    const others = pending.filter((pos) => !systemOf[pos]);
    skipList.replaceChildren(
      ...(osKeys.length
        ? [
            h('p', { textContent: '次のキーは Mac が先に受け取るので、ブラウザには届きません。押して画面が変わったらボタンを押してください:' }),
            ...osKeys.map((pos) =>
              h('button', {
                textContent: `${name(pos)}: ${systemOf[pos]}`,
                onclick: () => {
                  state[pos] = 'ok';
                  render();
                },
              }),
            ),
          ]
        : []),
      ...(others.length
        ? [
            h('p', { textContent: 'どうしても反応しないキーはスキップできます:' }),
            ...others.map((pos) =>
              h('button', {
                textContent: `${name(pos)} をスキップ`,
                onclick: () => {
                  state[pos] = 'skip';
                  render();
                },
              }),
            ),
          ]
        : []),
    );

    // 片側だけ全く反応しないときは配線より先に接続を疑う
    const leftPending = pending.filter(isLeft).length;
    const leftTotal = state.filter((_, p) => isLeft(p)).length;
    const rightPending = pending.length - leftPending;
    diagnosis.innerHTML =
      okCount >= 5 && leftPending === leftTotal
        ? '<p class="warn">左手側がひとつも反応していません。左手側の電源が入っているか、左右がつながっているか確認してください (電源は <b>左 → 右</b> の順に入れる)。</p>'
        : okCount >= 5 && rightPending === state.length - leftTotal
          ? '<p class="warn">右手側がひとつも反応していません。右手側の電源と Bluetooth 接続を確認してください。</p>'
          : '';

    if (pending.length === 0) {
      const skipped = state.flatMap((s, pos) => (s === 'skip' && (codesOf[pos].length || systemOf[pos]) ? [name(pos)] : []));
      diagnosis.innerHTML = skipped.length
        ? `<p class="warn">反応しなかったキー: ${skipped.join(', ')}。キースイッチがソケットにしっかり刺さっているか (ピンが曲がっていないか) を確認してみてください。</p>`
        : '<p class="ok">全部のキーが反応しました!</p>';
      ctx.complete();
    }
  };

  on(
    ctx,
    'keydown',
    (e) => {
      e.preventDefault();
      let matching = codesOf.flatMap((codes, pos) => (state[pos] !== 'skip' && codes.some((c) => eventMatches(e, c)) ? [pos] : []));
      if (!matching.length) return;
      const sameChar = matching.filter((p) => charOf(p) === e.key);
      if (sameChar.length) matching = sameChar;
      const pos = matching.find((p) => state[p] === 'pending') ?? matching[0];
      last = pos;
      state[pos] = 'ok';
      render();
    },
    false,
  );
  render();
};

// ---- トラックボール ----

type Dir = 'right' | 'left' | 'down' | 'up';
const DIR_LABEL: Record<Dir, string> = { right: '右 →', left: '← 左', down: '下 ↓', up: '↑ 上' };

export const trackball =
  (dirs: Dir[] = ['right', 'left', 'down', 'up']): Task =>
  (ctx) => {
    const pad = h('div', { className: 'pad' });
    const dot = h('div', { className: 'dot' });
    const arrow = h('div', { className: 'arrow' });
    const feedback = h('p', { className: 'feedback' });
    pad.append(dot, arrow);
    ctx.area.append(pad, feedback);
    ctx.setKeyboard(null);

    let i = 0;
    let net = 0; // 指示した向きへの正味の移動量。ブレて戻った分は差し引かれるだけで、溜まり続けない
    let x = 0;
    let y = 0;
    let idle = false;
    let idleTimer = setTimeout(() => showIdle(), 8000);
    const showIdle = () => {
      idle = true;
      feedback.innerHTML =
        '<span class="warn">カーソルが動いていないようです。右手側の電源と Bluetooth 接続を確認してください。ボールが外れていないか、センサーの穴にゴミが入っていないかも見てみてください。</span>';
    };
    ctx.signal.addEventListener('abort', () => clearTimeout(idleTimer));

    const render = () => {
      arrow.textContent = i < dirs.length ? DIR_LABEL[dirs[i]] : '完了!';
      dot.style.transform = `translate(${x}px, ${y}px)`;
    };

    on(ctx, 'mousemove', (e) => {
      if (i >= dirs.length) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(showIdle, 8000);
      if (idle) {
        idle = false;
        feedback.textContent = '';
      }
      x = Math.max(-120, Math.min(120, x + e.movementX * 0.3));
      y = Math.max(-60, Math.min(60, y + e.movementY * 0.3));
      const d = dirs[i];
      const v = d === 'right' ? e.movementX : d === 'left' ? -e.movementX : d === 'down' ? e.movementY : -e.movementY;
      net += v;
      if (net > 300) {
        i++;
        net = 0;
        x = y = 0;
        feedback.textContent = '';
        if (i === dirs.length) ctx.complete();
      } else if (net < -300) {
        feedback.innerHTML =
          '<span class="warn">反対方向に動いています。ボールを転がした向きとカーソルの向きが逆なら、ファームウェアの設定 (mona2_r.overlay の <code>invert-x</code> / <code>invert-y</code>) を見直す必要があります。</span>';
        net = 0;
      }
      render();
    });
    render();
  };

// ---- ホイール (エンコーダー / トラックボールスクロール) ----

export const wheel =
  (axes: ('y' | 'x')[], howTo: string, view?: KeyboardView): Task =>
  (ctx) => {
    const need = axes.flatMap((a) => (a === 'y' ? ['上', '下'] : ['左', '右']));
    const count: Record<string, number> = Object.fromEntries(need.map((d) => [d, 0]));
    const list = h('div', { className: 'wheel-dirs' });
    ctx.area.append(h('p', { innerHTML: howTo }), list);
    if (view) ctx.setKeyboard(view);

    const render = () => {
      list.replaceChildren(...need.map((d) => h('span', { className: count[d] >= 3 ? 'ok' : '', textContent: `${d} ${count[d] >= 3 ? '✓' : ''}` })));
    };

    on(
      ctx,
      'wheel',
      (e) => {
        e.preventDefault();
        const vertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
        const d = vertical ? (e.deltaY > 0 ? '下' : '上') : e.deltaX > 0 ? '右' : '左';
        if (d in count) count[d]++;
        render();
        if (need.every((n) => count[n] >= 3)) ctx.complete();
      },
      false,
    );
    render();
  };

// ---- ボールでスクロール: 縦と横で向きがそろっているか ----
// ボールを下に転がしたときの縦スクロールと、右に転がしたときの横スクロールは、同じ感覚 (中身がボールに付いてくる、
// または画面がボールの方へ進む) になるのが自然。片方だけ逆だと「左右 (上下) が逆」に感じる。
// Mac の「ナチュラルなスクロール」は縦横の両方を反転するので、そろっているかどうかの判定には影響しない。

type ScrollDir = 'down' | 'up' | 'right' | 'left';
const SCROLL_LABEL: Record<ScrollDir, string> = { down: '下 ↓', up: '↑ 上', right: '右 →', left: '← 左' };

export const scrollAxes =
  (howTo: string, fixHint: string, view?: KeyboardView): Task =>
  (ctx) => {
    const order: ScrollDir[] = ['down', 'up', 'right', 'left'];
    const sign: Partial<Record<ScrollDir, number>> = {};
    const list = h('ol', { className: 'steps' });
    const feedback = h('div', { className: 'feedback' });
    ctx.area.append(h('p', { innerHTML: howTo }), list, feedback);
    if (view) ctx.setKeyboard(view);

    let i = 0;
    let sum = 0;
    let count = 0;
    const render = () =>
      list.replaceChildren(
        ...order.map((d, j) => h('li', { className: j < i ? 'ok' : j === i ? 'current' : '', textContent: `ボールを ${SCROLL_LABEL[d]} に転がす` })),
      );

    const finish = () => {
      const vertical = sign.down;
      const horizontal = sign.right;
      const flipped = sign.up !== -sign.down! || sign.left !== -sign.right!;
      if (flipped) {
        feedback.innerHTML = '<p class="warn">往復で同じ向きにスクロールしていました。もう一度ゆっくり試してみてください。</p>';
      } else if (vertical === horizontal) {
        feedback.innerHTML = '<p class="ok">縦と横のスクロールの向きがそろっています。</p>';
      } else {
        feedback.innerHTML = `<p class="warn"><b>縦と横でスクロールの向きが食い違っています</b> (片方だけ逆に感じるはずです)。${fixHint}</p>`;
      }
      ctx.complete();
    };

    on(
      ctx,
      'wheel',
      (e) => {
        e.preventDefault();
        if (i >= order.length) return;
        const d = order[i];
        const v = d === 'down' || d === 'up' ? e.deltaY : e.deltaX;
        const cross = d === 'down' || d === 'up' ? e.deltaX : e.deltaY;
        if (Math.abs(v) < Math.abs(cross) || v === 0) return; // 指示と違う軸の動きは数えない
        sum += Math.sign(v);
        count++;
        if (count >= 3) {
          sign[d] = Math.sign(sum);
          i++;
          sum = count = 0;
          render();
          if (i === order.length) finish();
        }
      },
      false,
    );
    render();
  };

// ---- クリック ----

const BUTTON_NAME = ['左クリック', '中クリック (ホイールクリック)', '右クリック'];

export const click = (button: 0 | 1 | 2, view?: KeyboardView): Task =>
  Object.assign((ctx: TaskCtx) => {
    const target = h('div', { className: 'click-target', textContent: `ここを${BUTTON_NAME[button]}` });
    const feedback = h('p', { className: 'feedback' });
    ctx.area.append(target, feedback);
    ctx.setKeyboard(view ?? null);

    target.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: ctx.signal });
    target.addEventListener(
      'mousedown',
      (e) => {
        e.preventDefault();
        if (e.button === button) {
          target.classList.add('ok');
          target.textContent = 'OK!';
          feedback.textContent = '';
          ctx.complete();
        } else {
          feedback.innerHTML = `<span class="warn">今のは${BUTTON_NAME[e.button] ?? 'その他のボタン'}でした。</span>`;
        }
      },
      { signal: ctx.signal },
    );
  }, { missing: lacks(view) ? `${BUTTON_NAME[button]}のキーが、${NOT_IN_KEYMAP}。` : undefined });

// ---- ドラッグ ----

export const drag = (view?: KeyboardView): Task =>
  Object.assign((ctx: TaskCtx) => {
    const field = h('div', { className: 'drag-field' });
    const chip = h('div', { className: 'chip', textContent: '持ち上げて' });
    const zone = h('div', { className: 'zone', textContent: 'ここに置く' });
    const feedback = h('p', { className: 'feedback' });
    field.append(zone, chip);
    ctx.area.append(field, feedback);
    ctx.setKeyboard(view ?? null);

    let dragging = false;
    let dx = 0;
    let dy = 0;
    let done = false;
    chip.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 || done) return;
        dragging = true;
        chip.setPointerCapture(e.pointerId);
        chip.classList.add('lifted');
      },
      { signal: ctx.signal },
    );
    chip.addEventListener(
      'pointermove',
      (e) => {
        if (!dragging) return;
        dx += e.movementX;
        dy += e.movementY;
        chip.style.transform = `translate(${dx}px, ${dy}px)`;
      },
      { signal: ctx.signal },
    );
    chip.addEventListener(
      'pointerup',
      () => {
        if (!dragging) return;
        dragging = false;
        chip.classList.remove('lifted');
        const a = chip.getBoundingClientRect();
        const b = zone.getBoundingClientRect();
        const cx = a.left + a.width / 2;
        const cy = a.top + a.height / 2;
        if (cx > b.left && cx < b.right && cy > b.top && cy < b.bottom) {
          done = true;
          zone.classList.add('ok');
          zone.textContent = 'OK!';
          feedback.textContent = '';
          ctx.complete();
        } else {
          feedback.innerHTML = '<span class="warn">途中で離れてしまいました。クリックのキーを押したまま、ボールを転がしてください。</span>';
          dx = dy = 0;
          chip.style.transform = '';
        }
      },
      { signal: ctx.signal },
    );
  }, { missing: lacks(view) ? `左クリックのキーが、${NOT_IN_KEYMAP}。` : undefined });

// ---- 文字を打つ ----

// 打たせる行をテストから確かめられるように、課題関数に lines を持たせておく。
// 今のキーマップで打てない文字を含む行は出さない (1 行も打てなければ missingIn で課題ごと飛ばす)
export const type = (all: string[]): Task & { lines: string[] } =>
  Object.assign((ctx: TaskCtx) => {
    const lines = all.filter((l) => canType(ctx.km, l));
    let i = 0;
    const progress = h('p', { className: 'feedback' });
    const box = h('div');
    ctx.area.append(box, progress);
    const update = () => (progress.textContent = `${Math.min(i, lines.length)} / ${lines.length} 行`);
    mountTyping(box, {
      km: ctx.km,
      signal: ctx.signal,
      nextLine: () => lines[i],
      setKeyboard: ctx.setKeyboard,
      onLine: () => {
        i++;
        update();
      },
      onFinish: () => ctx.complete(),
    });
    update();
  }, { lines: all });

// ---- 日本語入力 ⇄ 英字入力の切り替え ----
// IME はテキスト欄にフォーカスがあるときしか働かないので、実際に欄へ打ってもらって変換が始まるかを見る。

export const imeToggle = (view: KeyboardView, toJapanese: string, toEnglish: string): Task =>
  Object.assign((ctx: TaskCtx) => {
    const steps = h('ol', { className: 'steps' });
    const input = h('input', { className: 'ime-input', placeholder: 'ここをクリックしてから操作', autocomplete: 'off' });
    const feedback = h('p', { className: 'feedback' });
    ctx.area.append(steps, input, feedback);
    ctx.setKeyboard(view);

    let step = 0; // 0: 日本語にして a → あ, 1: 英字に戻して a
    const labels = [`${toJapanese} で<b>日本語入力</b>にして、欄に <code>a</code> と打つ (「あ」になれば OK)`, `${toEnglish} で<b>英字入力</b>に戻して、<code>a</code> と打つ`];
    const render = () =>
      steps.replaceChildren(
        ...labels.map((l, j) => {
          const li = h('li', { className: j < step ? 'ok' : j === step ? 'current' : '' });
          li.innerHTML = l;
          return li;
        }),
      );

    const advance = () => {
      step++;
      feedback.textContent = '';
      render();
      if (step === labels.length) {
        input.disabled = true;
        ctx.complete();
      }
    };

    // 変換が始まった = 日本語入力になっている。変換中の欄は触らない (IME が壊れるため)
    input.addEventListener(
      'compositionstart',
      () => {
        if (step === 0) advance();
        else feedback.innerHTML = '<span class="warn">まだ日本語入力のままです。切り替えてから打ってください。</span>';
      },
      { signal: ctx.signal },
    );
    input.addEventListener(
      'input',
      (e) => {
        const ev = e as InputEvent;
        if (ev.isComposing || ev.data !== 'a') return;
        if (step === 1) advance();
        else feedback.innerHTML = '<span class="warn">英字のまま入力されました。先に入力を切り替えてから打ってください。</span>';
      },
      { signal: ctx.signal },
    );
    render();
    setTimeout(() => input.focus());
  }, { missing: lacks(view) ? `英数 / かな のキーが、${NOT_IN_KEYMAP}。` : undefined });
