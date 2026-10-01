import { sourceGuidance } from './source.ts';
import { currentOrigin, type KeymapOrigin } from '../lib/keymap-source.ts';
import { characterWay, keyName as keyNameForLesson, entryText, findWay, keyWay, layerContents, layerEntry, wayText, wayView, type Way } from './abilities.ts';
import { escapeHtml } from '../ui/dom.ts';
import { behaviorDef } from '../lib/zmk.ts';
import type { Keymap } from '../lib/layout.ts';
import { tapKeycode as tapKeycodeForLesson, bindingLabel, comboPositions, findKey, isBehavior, isKey, posOfTap, type Found } from '../lib/layout.ts';
import type { KeyboardView, Mark } from '../ui/keyboard.ts';
import { anyKey, click, confirmSteps, drag, imeToggle, keyTest, missingIn, press, read, scrollAxes, trackball, type, wheel, type Task } from './tasks.ts';

export type Lesson = {
  id: string;
  chapter: string;
  title: string;
  body: string; // HTML
  tips?: string[]; // つまずきやすいポイント (HTML)
  view?: KeyboardView; // 課題が始まる前に見せるキーボード
  task: Task;
  missing?: string; // このキーマップでは課題ができない理由 (押すキーが無いなど)。あれば課題を飛ばす
};

const ZMK_STUDIO_URL = 'https://zmk.studio/';

const found = (pos: number | undefined): pos is number => pos !== undefined && pos >= 0;

// 本文に差し込むキー名・レイヤー名。見つからないときもそれと分かる表示にする
const MISSING_KEY = '(キーなし)';

// レイヤー layer の中で条件に合うキー
function inLayer(km: Keymap, layer: number | undefined, match: Parameters<typeof findKey>[1]): Found | undefined {
  if (layer === undefined) return undefined;
  const pos = km.kb.layers[layer].bindings.findIndex(match);
  return pos >= 0 ? { layer, pos, layerKey: km.layerKeys.get(layer) } : undefined;
}

// ホールドで入るレイヤーのうち、そのキーを持つもの
function layerWith(km: Keymap, match: Parameters<typeof findKey>[1]): number | undefined {
  return findKey(km, match)?.layer;
}

export function keyPositions(km: Keymap) {
  const { kb, base } = km;
  const numLayer = layerWith(km, isKey('NUMBER_1'));
  const symLayer = layerWith(km, isKey('EXCLAMATION'));
  const navLayer = layerWith(km, isKey('UP_ARROW'));
  const esc = comboPositions(kb, 'ESC');
  const btParam = kb.combos.find((c) => c.positions.join() === esc.join())?.binding.params[0];
  // コンボの先がレイヤーでない (Esc コンボが無い、ただの &kp など) キーマップもある
  const btLayer = btParam !== undefined && kb.layers[Number(btParam)] ? Number(btParam) : undefined;
  const inBt = (match: Parameters<typeof findKey>[1]) => (btLayer === undefined ? -1 : kb.layers[btLayer].bindings.findIndex(match));

  return {
    f: posOfTap(km, 'F'),
    j: posOfTap(km, 'J'),
    space: posOfTap(km, 'SPACE'),
    enter: posOfTap(km, 'ENTER'),
    bs: posOfTap(km, 'BACKSPACE'),
    eisu: posOfTap(km, 'LANG2'),
    kana: posOfTap(km, 'LANG1'),
    zShift: kb.layers[base].bindings.findIndex(isBehavior('mt', 'LEFT_SHIFT', 'Z')),
    rShift: posOfTap(km, 'RIGHT_SHIFT'),
    ctrl: posOfTap(km, 'LCTRL'),
    cmd: kb.layers[base].bindings.flatMap((b, p) => (isKey('LEFT_WIN')(b) || isKey('LEFT_GUI')(b) ? [p] : [])),
    opt: posOfTap(km, 'LEFT_ALT'),
    tab: comboPositions(kb, 'TAB'),
    esc,
    numLayer,
    symLayer,
    navLayer,
    numKey: numLayer === undefined ? undefined : km.layerKeys.get(numLayer),
    symKey: symLayer === undefined ? undefined : km.layerKeys.get(symLayer),
    mb1: findKey(km, isBehavior('mkp', 'MB1')),
    mb2: findKey(km, isBehavior('mkp', 'MB2')),
    mb3: findKey(km, isBehavior('mkp', 'MB3')),
    up: inLayer(km, navLayer, isKey('UP_ARROW')),
    down: inLayer(km, navLayer, isKey('DOWN_ARROW')),
    left: inLayer(km, navLayer, isKey('LEFT_ARROW')),
    right: inLayer(km, navLayer, isKey('RIGHT_ARROW')),
    del: inLayer(km, navLayer, isKey('DELETE')),
    lineStart: inLayer(km, navLayer, isKey('LG(LEFT_ARROW)')),
    lineEnd: inLayer(km, navLayer, isKey('LG(RIGHT_ARROW)')),
    ctrlTab: inLayer(km, navLayer, isKey('LC(TAB)')),
    ctrlShiftTab: inLayer(km, navLayer, isKey('LC(LS(TAB))')),
    tabKey: posOfTap(km, 'TAB'),
    deskLeft: posOfTap(km, 'LC(LEFT_ARROW)'),
    deskRight: posOfTap(km, 'LC(RIGHT_ARROW)'),
    missionControl: inLayer(km, navLayer, isKey('LC(UP_ARROW)')),
    screenshot: inLayer(km, navLayer, isKey('LG(LS(N4))')),
    btLayer,
    btSel: [0, 1, 2, 3, 4].map((n) => inBt(isBehavior('bt', 'BT_SEL', String(n)))),
    btClr: inBt(isBehavior('bt', 'BT_CLR')),
    btClrAll: inBt(isBehavior('bt', 'BT_CLR_ALL')),
    bootloader: inBt(isBehavior('bootloader')),
  };
}

export function buildLessons(km: Keymap, origin: KeymapOrigin | null = currentOrigin()): Lesson[] {
  const source = sourceGuidance(origin ?? undefined);
  const k = keyPositions(km);
  const label = (layer: number, pos: number | undefined) => (found(pos) ? bindingLabel(km.effective(layer, pos)).tap : MISSING_KEY);
  const baseLabel = (pos: number | undefined) => label(km.base, pos);
  const numKey = baseLabel(k.numKey);
  const lessons: Lesson[] = [
    // ================= 1. はじめに =================
    {
      id: 'welcome',
      chapter: '1. はじめに',
      title: 'このアプリの使い方',
      body: `
        <p>moNa2 は左右に分かれた 42 キーのキーボードで、右手側にトラックボール、左手側にノブ (エンコーダー) が付いています。
        普通のキーボードより<strong>キーがかなり少ない</strong>ので、数字・記号・矢印・マウスのクリックは
        配置を切り替えたり、複数のキーを同時に押したりして出します。配置の切り替えを<strong>レイヤー</strong>と呼びます。</p>
        <p>このアプリでは次の順番で、実際に手を動かしながら進めます。</p>
        <ol>
          <li>つないで、全部のキーとトラックボールがちゃんと動くか確認する</li>
          <li>文字・親指キー・Shift の基本</li>
          <li>レイヤー (数字・記号・矢印)</li>
          <li>マウス操作 (クリック・ドラッグ・スクロール)</li>
          <li>Bluetooth と、キー配置の変え方</li>
        </ol>
        <p>画面の下にある<strong>入力モニター</strong>には、最後に届いたキーやクリックが常に表示されます。
        「押したのに何も起きない」ときは、まずここを見てください。</p>
        <p>進み具合はこのブラウザに保存されるので、途中でやめても左のメニューから続きができます。</p>
        <p class="note">このアプリは Mac で使う前提です。</p>`,
      task: read('はじめる'),
    },
    {
      id: 'power',
      chapter: '1. はじめに',
      title: '電源を入れてつなぐ',
      body: `
        <p>moNa2 は左右が無線でつながっています。<strong>右手側 (トラックボールがある方) が親</strong>で、
        Mac とつながるのは右手側、左手側は右手側を経由して入力を送ります。</p>
        <p>電源を入れる順番にはマナーがあります。</p>
        <ol>
          <li>まず<strong>左手側</strong>の電源を入れる</li>
          <li>次に<strong>右手側</strong>の電源を入れる</li>
        </ol>
        <p>すでにペアリング済みなら、これだけでつながります。
        まだの場合は Mac の「システム設定 → Bluetooth」に <code>mona2</code> が出てくるので接続してください。</p>
        <p>つながったら、moNa2 のどれかのキーを押すか、ボールを転がしてください。</p>`,
      tips: [
        '何も届かない → Bluetooth 設定で <code>mona2</code> が「接続済み」になっているか確認。電池切れの場合は USB-C で充電しながら試す。',
        '右手側だけ反応して左手側が反応しない → 電源を一度両方切って、<b>左 → 右</b> の順に入れ直す。',
      ],
      task: anyKey,
    },

    // ================= 2. 動作チェック =================
    {
      id: 'keytest',
      chapter: '2. 動作チェック',
      title: '全部のキーを押してみる',
      body: `
        <p>届いたキーやはんだ付けに問題がないか、42 個のキーを<strong>1 つずつ全部</strong>押して確かめます。
        反応したキーは図の上で緑になります。順番は自由です。</p>
        <p>短く押すと文字、長く押すと別の役割になるキーは、まずポンと短く押してください。
        Cmd や Ctrl のキーも押して大丈夫です。英数 / かな がある場合は入力モードが切り替わりますが、気にせず進めてください。</p>
        <p>Mac が先に受け取るショートカットは、ブラウザに届かないことがあります。
        下に確認ボタンが出るキーは、実際に押して画面の変化を確認してください。</p>`,
      tips: [
        '1 つだけ反応しない → そのキーのスイッチが斜めに刺さっていたり、ピンが曲がっていることが多い。抜いて差し直す。',
        '左右どちらか全部が反応しない → その側の電源・接続の問題。電源を左 → 右の順で入れ直す。',
      ],
      task: keyTest,
    },
    {
      id: 'trackball',
      chapter: '2. 動作チェック',
      title: 'トラックボール',
      body: `
        <p>右手側のボールを転がすとマウスカーソルが動きます。下の枠の中にカーソルを置いて、
        矢印の方向にボールを転がしてください。</p>
        <p>ボールを転がした向きとカーソルの動く向きが<strong>同じ</strong>になっているかも確認します。</p>`,
      tips: [
        'カーソルが全く動かない → 右手側の電源と接続を確認。ボールを一度外して、センサーの穴にほこりがないか見る。',
        '動きが逆 → ケースの種類 (COROPIT 版かどうか) によって、ファームウェアの設定 <code>invert-x</code> / <code>invert-y</code> を変える必要がある。',
        '速すぎる / 遅すぎる → Mac の「システム設定 → マウス → 軌跡の速さ」で調整できる。',
      ],
      task: trackball(),
    },
    {
      id: 'encoder',
      chapter: '2. 動作チェック',
      title: 'ノブ (エンコーダー)',
      body: `
        <p>左手側のノブ (回すつまみ) を回すと、マウスホイールと同じように<strong>画面が上下にスクロール</strong>します。
        両方の向きに、カチカチと何回か回してください。</p>
        <p>ノブの役割はレイヤーによって変わります (${numKey} を押しながらだと横スクロール、英数/かなを押しながらだと音量)。</p>`,
      tips: [
        '回しても何も起きない → 左手側の電源と接続を確認。',
        '上下が思っていたのと逆 → Mac の「ナチュラルなスクロール」設定の影響。システム設定 → マウス で切り替えられる。',
      ],
      task: wheel(['y'], 'ノブを両方向に回してください (それぞれ 3 回以上)。'),
    },

    // 機能ごとに、今のキーマップで出せる操作だけを練習する。
    ...abilityLessons(km, source),

    // ================= 6. Bluetooth とカスタマイズ =================
    {
      id: 'customize',
      chapter: '6. Bluetooth とカスタマイズ',
      title: 'キー配置を変えるには',
      body: `
        <p>キー配置は 2 通りの方法で変えられます。</p>
        <h3>ZMK Studio (ブラウザでその場で変える)</h3>
        <ol>
          <li>右手側を USB-C ケーブルで Mac につなぐ</li>
          <li><b>Chrome</b> で <a href="${ZMK_STUDIO_URL}" target="_blank" rel="noreferrer">${ZMK_STUDIO_URL}</a> を開く (Safari は非対応)</li>
          <li>接続して mona2 を選び、キーをクリックして割り当てを変える → 保存</li>
        </ol>
        <p>変更は右手側に保存されます。全部元に戻すには <code>settings_reset</code> を書き込みます (ペアリングも消えます)。</p>
        <h3>キーマップの設定ファイルを編集する</h3>
        <p>${source.keymap} を編集します。${source.build}
        キー配置の変更だけなら settings_reset は不要です。トラックボールの向きなど、キー配置以外の設定もこちらで変えられます。</p>
        <p class="note">${source.sync}</p>`,
      task: read(),
    },

    // ================= 7. 仕上げ =================
    {
      id: 'finish',
      chapter: '7. 仕上げ',
      title: '困ったときは',
      body: `
        <p>おつかれさまでした! これで moNa2 の基本操作はひと通りできるようになりました。
        最後に、よくあるトラブルをまとめておきます。</p>
        <dl>
          <dt>文字を打っても日本語になる / 反応しない</dt>
          <dd>「かな」モードになっています。<b>英数</b>をタップ。</dd>
          <dt>数字や記号が勝手に入る</dt>
          <dd>レイヤーが切り替わっています。「レイヤーのしくみ」で戻し方を確認してください。</dd>
          <dt>左手側だけ反応しない</dt>
          <dd>両方の電源を切って、<b>左 → 右</b> の順に入れ直す。</dd>
          <dt>全く反応しない</dt>
          <dd>Mac の Bluetooth 設定を確認。だめなら「Bluetooth」のレッスンのやり直し手順へ。</dd>
          <dt>急にキーボードが使えなくなった (Finder に USB ドライブが出てきた)</dt>
          <dd>Boot キーを押してしまっています。電源を入れ直せば元に戻ります。</dd>
          <dt>キー配置を変えたい</dt>
          <dd>ZMK Studio か、${source.keymap} を編集します (「キー配置を変えるには」を参照)。</dd>
        </dl>
        <p>あとは「自由練習」で毎日少しずつ打てば、すぐに慣れます。</p>`,
      task: read('完了!'),
    },
  ];
  return lessons.map((l) => ({ ...l, missing: missingIn(km, l.task) }));
}

function abilityLessons(km: Keymap, source: ReturnType<typeof sourceGuidance>): Lesson[] {
  const out: Lesson[] = [];
  const chapter = '3. 基本の打ち方';
  const add = (id: string, title: string, body: string, task: Task, view?: KeyboardView, ch = chapter) => out.push({ id, title, chapter: ch, body, task, view });
  const describe = (name: string, w: Way) => `<li><b>${name}</b>: ${wayText(km, w)}</li>`;
  const typing = (id: string, title: string, chars: string, lines: string[], intro: string, ch = '4. レイヤー') => {
    const available = [...new Set([...chars])].filter(c => km.charMap.has(c));
    if (!available.length) return;
    const usable = lines.filter(l => [...l].every(c => km.charMap.has(c)));
    const groups = new Map<string, { way: Way; chars: string[] }>();
    const shown = id === 'words' ? [' '].filter(c => available.includes(c)) : available;
    shown.forEach(c => {
      const way = characterWay(km, c)!;
      const signature = JSON.stringify(way.steps);
      const group = groups.get(signature) ?? { way, chars: [] };
      group.chars.push(c);
      groups.set(signature, group);
    });
    const examples = [...groups.values()].map(({ way, chars }) => {
      const sentence = !way.steps.length ? '次のキーを短く押します。'
        : way.steps.every(s => s.press === 'hold') ? `${entryText(km, way)}、次のキーを押します。`
        : `${entryText(km, way)}。そのあと、次のキーを押します。`;
      const keys = chars.map(c => `<li><b>${c === ' ' ? 'Space' : escapeHtml(c)}</b>: ${keyNameForLesson(km, characterWay(km, c)!.keys[0])}</li>`).join('');
      return `<p>${sentence}</p><ul>${keys}</ul>`;
    });
    add(id, title, `<p>${intro}</p>${examples.join('')}<p>下の図で次に押すキーを確認しながら、ゆっくり正確に打ってみましょう。</p>`, type(usable.length ? usable : [available.join('')]), wayView(characterWay(km, available[0])), ch);
  };
  typing('home', 'ホームポジション', 'fj', ['fjfj', 'fdsajkl;', 'asdfjkl;', 'fgfghjhj', 'dash', 'flask'], '指の基本位置を覚えます。moNa2 は縦にキーが並ぶ格子配列です。図で F と J の位置を確認して、人差し指を置きましょう。各指はまっすぐ上下に動かします。', chapter);
  const basics = [['Space', 'SPACE', 'Space'], ['Enter', 'ENTER', 'Enter'], ['BS (1 文字消す)', 'BACKSPACE', 'Backspace']] as const;
  const basicWays = basics.flatMap(([name, code, event]) => { const w = keyWay(km, code); return w ? [{ name, event, w }] : []; });
  if (basicWays.length) add('thumbs', 'Space・Enter・Backspace', `<p>よく使う基本操作を覚えます。</p><ul>${basicWays.map(x => describe(x.name, x.w)).join('')}</ul><p>短く押すと文字、長く押すと別の役割になるキーは、ポンと押してすぐ離してください。</p>`, press(basicWays.map(x => ({ prompt: wayText(km, x.w), codes: [x.event], view: wayView(x.w) }))));
  const eisu = keyWay(km, 'LANG2'), kana = keyWay(km, 'LANG1');
  if (eisu && kana) add('ime', '英数 / かな (日本語入力)', `<p>Mac の日本語キーボードと同じで、かなを押すと日本語入力、英数を押すと英字入力になります。</p><ul>${describe('かな', kana)}${describe('英数', eisu)}</ul><p>下の欄をクリックして試してください。このアプリの文字練習は英数モードで行います。</p>`, imeToggle(wayView(kana)!, wayText(km, kana), wayText(km, eisu)));
  typing('words', '単語を打つ', 'abcdefghijklmnopqrstuvwxyz ', ['ask dad', 'a lad falls', 'the quick brown fox', 'jumps over the lazy dog'], '文字と Space を組み合わせて単語を打ちます。ゆっくりで大丈夫なので、正確に打つことを意識してください。', chapter);
  const shiftWays = [...km.charMap.values()].filter(s => s.steps.some(t => t.role === 'shift'));
  if (shiftWays.length) {
    const shiftKeys = [...new Set(shiftWays.flatMap(s => s.steps.filter(t => t.role === 'shift').flatMap(t => t.keys)))];
    const details = shiftKeys.map(p => {
      const b = km.kb.layers[km.base].bindings[p], def = behaviorDef(b), label = bindingLabel(b);
      return `<li>${label.tap}: ${def?.type === 'hold-tap' ? `短く押すと「${label.tap}」、押したままだと Shift (mod-tap)` : def?.type === 'sticky-key' ? '押して離すと次のキー 1 回だけ Shift (ワンショット)' : '押したままで Shift'}</li>`;
    });
    const sides = new Set(shiftKeys.map(p => km.kb.keys[p].x < Math.max(...km.kb.keys.map(k => k.x)) / 2));
    typing('shift', '大文字 (Shift)', 'AJZ', ['Apple', 'Hello World', 'zoo', 'Zoom', 'Why?', 'a: b < c > d'], `Shift を使うと大文字を打てます。</p><ul>${details.join('')}</ul><p>${sides.size === 2 ? '左右両方に Shift があるので、打つ文字と反対の手の Shift を使うと楽です。' : ''}ホールドの場合は Shift を押す → 文字キーを押して離す → Shift を離す、の順です。`, chapter);
  }
  const special = [['Tab', 'TAB', 'Tab'], ['Esc', 'ESC', 'Escape']] as const;
  const specialWays = special.flatMap(([name, code, event]) => { const w = keyWay(km, code); return w ? [{ name, event, w }] : []; });
  if (specialWays.length) add('combos', 'Tab と Esc', `<p>入力欄の移動や、操作の取り消しに使うキーです。</p><ul>${specialWays.map(x => describe(x.name, x.w)).join('')}</ul>${specialWays.some(x => x.w.keys.length > 1) ? '<p>同時押しは「コンボ」と呼びます。2 本の指で 1 つのキーを押すように、パッと押してパッと離しましょう。タイミングがずれると、別々のキーとして入力されます。</p>' : ''}`, press(specialWays.map(x => ({ prompt: wayText(km, x.w), codes: [x.event], view: wayView(x.w) }))));
  const modifiers = [['Ctrl', 'LEFT_CONTROL', 'ControlLeft'], ['Cmd', 'LEFT_GUI', 'MetaLeft'], ['Option', 'LEFT_ALT', 'AltLeft']] as const;
  const mods = modifiers.flatMap(([name, code, event]) => {
    const w = findWay(km, b => { const d = behaviorDef(b); const c = d?.type === 'hold-tap' ? b.params[0] : tapKeycodeForLesson(b); return [code, ...(name === 'Ctrl' ? ['LCTRL', 'LEFT_CTRL'] : name === 'Cmd' ? ['LEFT_WIN', 'LGUI'] : ['LALT'])].includes(c as typeof code); });
    return w ? [{ name, event, w }] : [];
  });
  if (mods.length) add('modifiers', 'Cmd / Ctrl / Option', `<p>ショートカットに使う修飾キーです。図のキーを押したまま、文字キーを押します。短く押すと文字になるキーは、しっかりホールドしてください。</p><ul>${mods.map(x => `<li><b>${x.name}</b>: ${entryText(km, x.w)}、${x.w.keys.map(p => keyNameForLesson(km, p)).join(' + ')} を押したまま</li>`).join('')}</ul><p>Cmd + C はコピー、Cmd + V は貼り付け、Cmd + Z は取り消しです。</p>`, press(mods.map(x => ({ prompt: `${x.name} として図のキーを押す`, codes: [x.event], view: wayView(x.w) }))));
  const routes = km.reachable.filter(l => l !== km.base).map(l => `<tr><td>${entryText(km, layerEntry(km, l)!)}</td><td>L${l}</td><td>${layerContents(km, l)}</td></tr>`);
  if (routes.length) add('layers', 'レイヤーのしくみ', `<p>レイヤーはキーボードの「裏面」のようなものです。配置を切り替えると、同じキーで数字や記号などを出せます。</p><table><tr><th>切り替え方</th><th>レイヤー</th><th>出せるもの</th></tr>${routes.join('')}</table><p>ホールドは切り替えキーを押したまま、目的のキーを押して離し、最後に切り替えキーを離します。トグルは切り替わったままなので、もう一度押して戻します。ワンショットは次のキー 1 回だけ有効です。</p><p>下の図のタブで配置を確認できます。薄いキーは下のレイヤーのままのキーです。</p>`, read('わかった'), undefined, '4. レイヤー');
  typing('numbers', '数字', '1234567890', ['123', '4567890', '2026', '1 2 3'], '数字の出し方を覚えます。まず切り替え操作をしてから数字キーを押しましょう。');
  typing('brackets', 'カッコ', '[](){}\\|', ['()', '[]', 'f(x)', 'a[0]', '{}'], 'カッコは文章やプログラムで使います。Shift が必要なものは、切り替えキーと Shift の両方を押さえます。');
  typing('symbols', '記号', '!@#$%^&*`~"\'=+-_', ['!?', '@#$%', 'a-b_c', 'x = y + 1', `"hi" 'yo'`, '~/`'], '記号の出し方を確認します。普通のキーボードで Shift と数字を押していた記号も、専用の配置から出せることがあります。');
  const nav = [['↑', 'UP_ARROW', 'ArrowUp'], ['↓', 'DOWN_ARROW', 'ArrowDown'], ['←', 'LEFT_ARROW', 'ArrowLeft'], ['→', 'RIGHT_ARROW', 'ArrowRight'], ['Delete', 'DELETE', 'Delete'], ['⌘← (行頭)', 'LG(LEFT_ARROW)', 'Meta+ArrowLeft'], ['⌘→ (行末)', 'LG(RIGHT_ARROW)', 'Meta+ArrowRight']] as const;
  const navWays = nav.flatMap(([name, code, event]) => { const w = keyWay(km, code); return w ? [{ name, event, w }] : []; });
  if (navWays.length) add('arrows', '矢印と移動', `<p>カーソルを動かす操作です。Mac では ⌘← / ⌘→ で行の先頭・末尾へ移動できます。</p><ul>${navWays.map(x => describe(x.name, x.w)).join('')}</ul><p>切り替えキーを先に操作してから、矢印を押してください。</p>`, press(navWays.map(x => ({ prompt: wayText(km, x.w), codes: [x.event], view: wayView(x.w) }))), undefined, '4. レイヤー');
  const desktops = [['左のデスクトップへ', 'LC(LEFT_ARROW)'], ['右のデスクトップへ', 'LC(RIGHT_ARROW)'], ['Mission Control (画面の一覧)', 'LC(UP_ARROW)'], ['スクリーンショット', 'LG(LS(N4))']] as const;
  const desktopWays: { name: string; w: Way }[] = desktops.flatMap(([name, code]) => { const w = keyWay(km, code); return w ? [{name, w}] : []; });
  const cmd = mods.find(m => m.name === 'Cmd');
  const tab = keyWay(km, 'TAB');
  if (cmd && tab && cmd.w.layer === km.base && tab.layer === km.base) {
    desktopWays.push({ name: 'アプリの切り替え (Cmd を押したまま Tab。Cmd を離すと決まる)', w: tab });
  }
  if (desktopWays.length) add('desktops', 'デスクトップと画面操作', `<p>Mac が直接受け取る操作です。実際に押して画面が変わったら、確認ボタンを押してください。</p><ul>${desktopWays.map(x => describe(x.name, x.w)).join('')}</ul><p>デスクトップを移動できないときは Mission Control でデスクトップを追加し、Mac のキーボードショートカット設定を確認してください。</p>`, confirmSteps(desktopWays.map(x => ({ prompt: `${x.name}: ${wayText(km, x.w)}`, done: '確認した', view: x.w === tab && cmd ? { ...wayView(x.w)!, marks: new Map([...wayView(x.w)!.marks!, ...cmd.w.keys.map((p): [number, Mark] => [p, 'hold'])]) } : wayView(x.w) }))));
  for (const [id, name, button, param] of [['click-left', '左クリック', 0, 'MB1'], ['click-right', '右クリック', 2, 'MB2'], ['click-middle', '中クリック', 1, 'MB3']] as const) {
    const w = findWay(km, isBehavior('mkp', param));
    if (!w) continue;
    add(id, name, `<p>${wayText(km, w)}と、${name}ができます。ボールでカーソルを下の枠に合わせて試してください。</p>`, click(button, wayView(w)), wayView(w), '5. マウス');
    if (param === 'MB1') add('drag', 'ドラッグ', `<p>クリックのキーを押さえたままボールを転がすと、ものをつかんで運べます。</p><ol><li>カーソルを「持ち上げて」に合わせる</li><li>${entryText(km, w)}、${w.keys.map(p => keyNameForLesson(km, p)).join(' + ')} を押したままにする</li><li>ボールを転がして「ここに置く」まで運ぶ</li><li>クリックのキーを離す</li></ol><p>途中で落ちる場合は、クリックやホールドのキーが離れていないか確認してください。</p>`, drag(wayView(w)), wayView(w), '5. マウス');
  }
  const scrollLayer = (km.kb.pointing?.scrollLayers ?? [keyWay(km, 'UP_ARROW')?.layer]).find((l): l is number => l !== undefined && !!layerEntry(km, l));
  if (scrollLayer !== undefined) {
    const w = layerEntry(km, scrollLayer)!;
    const instruction = entryText(km, w);
    add('scroll', 'ボールでスクロール', `<p>${instruction}、ボールを転がすと、カーソルは動かずに画面がスクロールします。縦にも横にもスクロールできます。左手のノブでも縦スクロールできるので、使いやすい方を使ってください。</p>`, scrollAxes(`${instruction}、指示の向きにボールを転がしてください。`, scrollRepair(km, source)), wayView(w), '5. マウス');
  }
  const bt = findWay(km, isBehavior('bt'));
  if (bt) {
    const functions = km.kb.layers.flatMap(l => l.bindings).filter(isBehavior('bt'));
    const unique = [...new Map(functions.map(b => [b.params.join(), b])).values()];
    const entries = unique.flatMap(b => { const w = findWay(km, isBehavior('bt', ...b.params)); return w ? [describe(bindingLabel(b).tap, w)] : []; });
    const boot = findWay(km, isBehavior('bootloader'));
    const btView = wayView(bt)!;
    if (boot?.layer === bt.layer) boot.keys.forEach(p => btView.marks!.set(p, 'warn'));
    add('bluetooth', 'Bluetooth', `<p>Bluetooth の設定は、${entryText(km, bt)}の操作から始めます。ここは試しに押す必要はありません。読んで場所だけ覚えてください。</p><ul>${entries.join('')}</ul><p>BT 番号は接続先です。空いている番号を選び、新しい機器の Bluetooth 設定から mona2 を接続します。以後は BT 番号で接続先を切り替えます。</p>${unique.some(b => b.params[0] === 'BT_CLR') ? '<p>つながらなくなったときは、Mac で mona2 の登録を解除し、BT消去で今の接続先のペアリングを消して、もう一度接続します。全消去はすべての接続先を消すので注意してください。</p>' : ''}${boot ? `<p class="danger">Boot (${boot.keys.map(p => keyNameForLesson(km, p)).join(' + ')} の位置) は押さないでください。書き込みモードに入り、一時的に使えなくなります。押してしまったら電源を入れ直してください。</p>` : ''}`, read(), btView, '6. Bluetooth とカスタマイズ');
  }
  return out.sort((a, b) => a.chapter.localeCompare(b.chapter));
}

function scrollRepair(km: Keymap, source: ReturnType<typeof sourceGuidance>): string {
  const fix = (axis: 'X' | 'Y', inverted: boolean | undefined) => `<code>INPUT_TRANSFORM_${axis}_INVERT</code> ${inverted === undefined ? 'の有無を確認して切り替える' : inverted ? 'を外す' : 'を追加する'}`;
  return `Mac の「ナチュラルなスクロール」設定を確認してください。左右だけ (または上下だけ) 逆なら、${source.overlay} の <code>scroller</code> の <code>&amp;zip_scroll_transform</code> で、左右は ${fix('X', km.kb.pointing?.scrollInvertX)}、上下は ${fix('Y', km.kb.pointing?.scrollInvertY)}。${source.build}`;
}
