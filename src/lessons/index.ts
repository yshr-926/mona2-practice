// レッスン本体。上から順に進めれば、電源の入れ方からマウス操作まで一通りできるようになる構成。
// 対象は Mac + zmk-config-moNa2-v2 (yshr-926) のファームウェア。
// キーの位置は同期したキーマップから「意味」で引く (左クリックのキー、矢印のレイヤー、など) が、
// 説明文はこのキーマップ前提で書いているので、キーマップを大きく変えて lessons.test.ts が落ちたら文章も直すこと。

import type { Keymap } from '../lib/layout.ts';
import { bindingLabel, comboPositions, findKey, isBehavior, isKey, posOfTap, type Found } from '../lib/layout.ts';
import type { KeyboardView, Mark } from '../ui/keyboard.ts';
import { anyKey, click, confirmSteps, drag, imeToggle, keyTest, missingIn, press, read, scrollAxes, trackball, type, wheel, type PressStep, type Task } from './tasks.ts';

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

const REPO_URL = 'https://github.com/yshr-926/zmk-config-moNa2-v2';
const ZMK_STUDIO_URL = 'https://zmk.studio/';

const found = (pos: number | undefined): pos is number => pos !== undefined && pos >= 0;

// 見つからなかったキーは図に出さない。押すキーが欠けていたら missing にして、課題側で「このキーマップにはありません」と出す
const view = (layer: number, marks: [number | undefined, Mark][], caption?: string): KeyboardView => ({
  layer,
  marks: new Map(marks.filter((m): m is [number, Mark] => found(m[0]))),
  caption,
  missing: marks.some(([pos, mark]) => mark !== 'warn' && !found(pos)) || undefined,
});

// 本文に差し込むキー名・レイヤー名。見つからないときもそれと分かる表示にする
const MISSING_KEY = '(キーなし)';
const layerName = (layer: number | undefined) => (layer === undefined ? 'L?' : `L${layer}`);

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

export function buildLessons(km: Keymap): Lesson[] {
  const k = keyPositions(km);
  const label = (layer: number, pos: number | undefined) => (found(pos) ? bindingLabel(km.effective(layer, pos)).tap : MISSING_KEY);
  const baseLabel = (pos: number | undefined) => label(km.base, pos);
  const numKey = baseLabel(k.numKey);
  const symKey = baseLabel(k.symKey);
  const layerView = (f: Found | undefined, extra: [number | undefined, Mark][] = []) =>
    f ? view(f.layer, [...(f.layer === km.base ? [] : [[f.layerKey, 'hold'] as [number | undefined, Mark]]), [f.pos, 'target'], ...extra]) : undefined;
  const pressFound = (prompt: string, f: Found | undefined, codes: string[], extra: [number | undefined, Mark][] = []): PressStep => ({
    prompt,
    codes,
    view: layerView(f, extra),
  });
  const pointing = km.kb.pointing;
  const scrollLayers = pointing?.scrollLayers ?? (k.navLayer === undefined ? [] : [k.navLayer]);
  const scrollLayer = scrollLayers.find((layer) => km.kb.layers[layer]);
  const scrollKey = scrollLayer === undefined ? undefined : km.layerKeys.get(scrollLayer);
  const scrollHold = scrollKey === undefined ? (scrollLayer === undefined ? 'スクロール用レイヤーなし' : `L${scrollLayer} を有効にするキー`) : baseLabel(scrollKey);
  const scrollInstruction = scrollLayer === undefined
    ? (pointing ? '読み込んだ overlay にはスクロールするレイヤーがありません。ファームウェアの設定を確認してください。' : '英数 か かな を押したまま')
    : `${scrollHold} を押したまま`;
  const scrollFix = (axis: 'X' | 'Y', inverted: boolean | undefined) =>
    `<code>INPUT_TRANSFORM_${axis}_INVERT</code> ${inverted === undefined ? 'の有無を確認して切り替える' : inverted ? 'を外す' : 'を追加する'}`;
  const navWarn: [number | undefined, Mark][] = [
    [k.ctrlTab?.pos, 'warn'],
    [k.ctrlShiftTab?.pos, 'warn'],
  ];

  const lessons: Lesson[] = [
    // ================= 1. はじめに =================
    {
      id: 'welcome',
      chapter: '1. はじめに',
      title: 'このアプリの使い方',
      body: `
        <p>moNa2 は左右に分かれた 42 キーのキーボードで、右手側にトラックボール、左手側にノブ (エンコーダー) が付いています。
        普通のキーボードより<strong>キーがかなり少ない</strong>ので、数字・記号・矢印・マウスのクリックは
        「親指のキーを押しながら別のキーを押す」という操作で出します。これを<strong>レイヤー</strong>と呼びます。</p>
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
        <p>押しっぱなしにする必要はありません。全部ポンと短く押してください。
        (Z や Enter のように 2 つの役割を持つキーも、短く押せば OK です)</p>
        <p class="note">Cmd や Ctrl のキーも押して大丈夫です。このページではショートカットが起きないようにしてあります。
        英数 / かな を押すと入力モードが切り替わりますが、気にせず進めてください。</p>
        <p class="note">真ん中の <b>⌃←</b> / <b>⌃→</b> は Mac のデスクトップ切り替えです。押すとデスクトップが移動するので、
        反対側のキーで戻ってきてから「移動した」ボタンを押してください (デスクトップが 1 つしかないと何も起きません。その場合はスキップで OK)。</p>`,
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

    // ================= 3. 基本の打ち方 =================
    {
      id: 'home',
      chapter: '3. 基本の打ち方',
      title: 'ホームポジション',
      body: `
        <p>指の基本位置です。左手の人差し指を <b>F</b>、右手の人差し指を <b>J</b> に置き、
        残りの指はそのまま横に並べます (左: A S D F / 右: J K L ;)。</p>
        <p>moNa2 は縦にまっすぐキーが並んでいる (格子配列) ので、普通のキーボードのように斜めに指を動かす必要はありません。
        <strong>各指はまっすぐ上下に動かす</strong>だけです。</p>
        <p>G と H は人差し指を内側に伸ばして押します。
        真ん中の列にある <b>Tab</b>、<b>⌃←</b>、<b>⌃→</b> は文字入力では使わないキーです (⌃← / ⌃→ はデスクトップの切り替え。あとのレッスンで使います)。</p>`,
      view: view(km.base, [
        [k.f, 'target'],
        [k.j, 'target'],
      ]),
      task: type(['fjfj', 'fdsajkl;', 'asdfjkl;', 'fgfghjhj', 'dash', 'flask']),
    },
    {
      id: 'thumbs',
      chapter: '3. 基本の打ち方',
      title: '親指のキー',
      body: `
        <p>親指の段にはよく使うキーが集まっています。</p>
        <ul>
          <li>左手: <b>BS</b> (1 文字消す)、<b>Enter</b> (改行)、<b>英数</b></li>
          <li>右手: <b>かな</b>、<b>Space</b></li>
        </ul>
        <p>Space・Enter・英数・かなは、<strong>短く押すと普通のキー</strong>、<strong>押しっぱなしにするとレイヤー切り替え</strong>になります。
        なので Space を長押ししても空白は連続で入りません。空白を何個も入れたいときは何回もタップします。</p>`,
      tips: ['Space を押したつもりが何も入らない → 押している時間が長すぎる。「ポン」と短く。'],
      task: press([
        { prompt: '<b>Space</b> をタップ', codes: ['Space'], view: view(km.base, [[k.space, 'target']]) },
        { prompt: '<b>Enter</b> をタップ', codes: ['Enter'], view: view(km.base, [[k.enter, 'target']]) },
        { prompt: '<b>BS</b> (Backspace) をタップ', codes: ['Backspace'], view: view(km.base, [[k.bs, 'target']]) },
      ]),
    },
    {
      id: 'ime',
      chapter: '3. 基本の打ち方',
      title: '英数 / かな (日本語入力)',
      body: `
        <p>親指の位置に<strong>「英数」(左手)</strong>と<strong>「かな」(右手)</strong>キーがあります。
        Mac の日本語キーボードと同じで、<b>かな</b>を押すと日本語入力、<b>英数</b>を押すと英字入力になります。</p>
        <p>このキーは<strong>短く押す (タップ)</strong>と切り替え、<strong>押しっぱなし</strong>にすると矢印などのレイヤーになります。
        ポンと短く押してください。</p>
        <p>下の欄をクリックしてから試してください。</p>
        <p class="note">このアプリの練習は<strong>英数モード</strong>で行います。文字を打っても反応しないときは、たいてい「かな」になっています。</p>`,
      tips: [
        '押しても切り替わらない → 押している時間が長い (0.2 秒以上だとホールド扱い)。指をすぐ離す。',
        'それでも切り替わらない → Mac の「システム設定 → キーボード → 入力ソース」に日本語 (ローマ字入力) が追加されているか確認。',
      ],
      task: imeToggle(
        view(km.base, [
          [k.kana, 'target'],
          [k.eisu, 'target'],
        ]),
        '<b>かな</b> をタップ',
        '<b>英数</b> をタップ',
      ),
    },
    {
      id: 'words',
      chapter: '3. 基本の打ち方',
      title: '単語を打つ',
      body: `
        <p>文字と Space を組み合わせて単語を打ちます。ゆっくりで大丈夫なので、正確に打つことを意識してください。</p>
        <p class="note">画面のキーボードは「次に押すキー」を青く光らせます。慣れるまでは手元ではなく画面を見て打つ練習をしましょう。</p>`,
      tips: ['空白を打ったはずなのに数字や記号が出る → Space を押したまま次の文字を押している。<b>Space を離してから</b>次のキーを押す。'],
      task: type(['ask dad', 'a lad falls', 'the quick brown fox', 'jumps over the lazy dog']),
    },
    {
      id: 'shift',
      chapter: '3. 基本の打ち方',
      title: '大文字 (Shift)',
      body: `
        <p>Shift は 2 か所にあります。</p>
        <ul>
          <li><b>右下の角</b>: 普通の Shift</li>
          <li><b>左下の Z</b>: 短く押すと「z」、<strong>押したまま</strong>だと Shift</li>
        </ul>
        <p>基本は<strong>打つ文字と反対の手の Shift</strong> を使います。A (左手) なら右下の Shift、J (右手) なら Z の Shift です。
        押す順番は「Shift を押す → 押したまま文字キーを押して離す → Shift を離す」です。
        大文字の Z は右下の Shift + Z で打ちます。</p>
        <p><code>: &lt; &gt; ?</code> も Shift + <code>; , . /</code> で出せます。</p>`,
      view: view(km.base, [
        [k.zShift, 'shift'],
        [k.rShift, 'shift'],
      ]),
      tips: ['「za」と打ちたいのに「A」になる → Z を離す前に次のキーを押している。Z は素早く離す。'],
      task: type(['Apple', 'Hello World', 'zoo', 'Zoom', 'Why?', 'a: b < c > d']),
    },
    {
      id: 'combos',
      chapter: '3. 基本の打ち方',
      title: '同時押し (Tab と Esc)',
      body: `
        <p>いくつかのキーは、<strong>2 つのキーを同時に押す</strong>ことで出します (「コンボ」と呼びます)。</p>
        <ul>
          <li><b>S + D</b> を同時に押す → <b>Tab</b></li>
          <li><b>英数 + かな</b> を同時にタップ → <b>Esc</b></li>
        </ul>
        <p>「ほぼ同時」に押す必要があります。ずれると普通に「sd」と入力されます。
        2 本の指で 1 つのキーを押すようなイメージで、パッと押してパッと離してください。</p>`,
      tips: [
        '「sd」と入力されてしまう → 押すタイミングがずれている。ほんの少しでもずれると別々のキーとして扱われる。',
        '英数 + かな を押しっぱなしにすると、Esc ではなく Bluetooth 設定のレイヤーになる。短く押すこと。',
      ],
      task: press([
        { prompt: '<b>S + D</b> を同時に押して Tab', codes: ['Tab'], view: view(km.base, k.tab.map((p) => [p, 'target'])) },
        { prompt: '<b>英数 + かな</b> を同時にタップして Esc', codes: ['Escape'], view: view(km.base, k.esc.map((p) => [p, 'target'])) },
      ]),
    },
    {
      id: 'modifiers',
      chapter: '3. 基本の打ち方',
      title: 'Cmd / Ctrl / Option',
      body: `
        <p>ショートカットで使う修飾キーは一番下の段の端にあります。</p>
        <p>左下は MacBook と同じく <b>Ctrl (⌃)</b>、<b>Option (⌥)</b>、<b>Cmd (⌘)</b> の順に並んでいます。
        Cmd は BS のすぐ左で、親指でも届きます。</p>
        <p>コピーなら <b>Cmd を押したまま C</b>、貼り付けは <b>Cmd + V</b>、取り消しは <b>Cmd + Z</b> です。</p>`,
      tips: ['Cmd + Z の Z は、Z を短く押すこと (押しっぱなしだと Shift 扱いになる)。'],
      task: press([
        { prompt: '<b>Ctrl</b> を押す', codes: ['ControlLeft'], view: view(km.base, [[k.ctrl, 'target']]) },
        { prompt: '<b>Cmd</b> を押す', codes: ['MetaLeft'], view: view(km.base, k.cmd.map((p) => [p, 'target'])) },
        { prompt: '<b>Option</b> を押す', codes: ['AltLeft'], view: view(km.base, [[k.opt, 'target']]) },
        {
          prompt: '<b>Cmd を押したまま Z</b> (取り消し)',
          codes: ['Meta+KeyZ'],
          view: view(km.base, [...k.cmd.map((p): [number, Mark] => [p, 'hold']), [k.zShift, 'target']]),
        },
      ]),
    },

    {
      id: 'desktops',
      chapter: '3. 基本の打ち方',
      title: 'デスクトップとアプリの切り替え',
      body: `
        <p>Mac のよく使う画面操作が、真ん中の列に入っています。</p>
        <ul>
          <li><b>⌃←</b> (左手側の真ん中) → 左のデスクトップへ</li>
          <li><b>⌃→</b> (右手側の真ん中) → 右のデスクトップへ</li>
          <li><b>Cmd を押したまま Tab</b> (右手側の上の真ん中) → アプリの切り替え</li>
          <li><b>英数を押したまま T</b> → Mission Control (開いている画面の一覧)</li>
        </ul>
        <p>これらは Mac が直接受け取る操作なので、このページでは判定できません。
        実際に押して、画面が変わったらボタンを押してください。</p>`,
      tips: [
        '⌃← / ⌃→ で何も起きない → デスクトップが 1 つしかない。Mission Control を開いて、右上の「+」でデスクトップを追加する。',
        'それでも動かない → Mac の「システム設定 → キーボード → キーボードショートカット → Mission Control」で「左 / 右の操作スペースに移動」がオンか確認。',
        'Cmd + Tab は Cmd を押したまま Tab を何回か押すと、切り替え先を選べる。Cmd を離したところで決まる。',
      ],
      task: confirmSteps([
        { prompt: '<b>⌃→</b> を押して右のデスクトップへ', done: '移動した', view: view(km.base, [[k.deskRight, 'target']]) },
        { prompt: '<b>⌃←</b> を押してこのページに戻る', done: '戻ってきた', view: view(km.base, [[k.deskLeft, 'target']]) },
        {
          prompt: '<b>Cmd を押したまま Tab</b> でアプリを切り替え、もう一度押してこのページに戻る',
          done: '切り替えられた',
          view: view(km.base, [...k.cmd.map((p): [number, Mark] => [p, 'hold']), [k.tabKey, 'target']]),
        },
        { prompt: '<b>英数を押したまま T</b> で Mission Control を開き、もう一度押して閉じる', done: '開いて閉じた', view: layerView(k.missionControl) },
      ]),
    },

    // ================= 4. レイヤー =================
    {
      id: 'layers',
      chapter: '4. レイヤー',
      title: 'レイヤーのしくみ',
      body: `
        <p>キーが 42 個しかないので、<strong>親指キーを押している間だけ、キーボード全体の配置が切り替わる</strong>しくみになっています。
        これがレイヤーです。キーボードの「裏面」がいくつかあって、親指で裏返しているイメージです。</p>
        <table>
          <tr><th>押しっぱなしにするキー</th><th>レイヤー</th><th>出せるもの</th></tr>
          <tr><td>${numKey} (右親指)</td><td>${layerName(k.numLayer)}</td><td>数字、[ ] ( ) \\ |</td></tr>
          <tr><td>${symKey} (左親指)</td><td>${layerName(k.symLayer)}</td><td>記号、F1〜F12、<strong>マウスクリック</strong></td></tr>
          <tr><td>英数 または かな</td><td>${layerName(k.navLayer)}</td><td>矢印、行頭・行末への移動、Delete、スクショ、Mission Control${scrollLayers.includes(k.navLayer ?? -1) ? '、<strong>ボールでスクロール</strong>' : ''}</td></tr>
          <tr><td>英数 + かな を両方</td><td>${layerName(k.btLayer)}</td><td>Bluetooth の切り替え</td></tr>
        </table>
        <p><strong>押す順番が大事</strong>です:</p>
        <ol>
          <li>親指キーを押して、そのまま押さえておく</li>
          <li>出したいキーを押して離す</li>
          <li>親指キーを離す</li>
        </ol>
        <p>下の図のタブで各レイヤーの配置を見られます。薄いキーはそのレイヤーでは何も変わらない (元のまま) キーです。</p>`,
      tips: [
        '親指キーを押している時間が短すぎると、レイヤーではなく Space や Enter が入力される。しっかり押さえてから次のキーへ。',
        '迷子になったら 英数 か かな をタップすると、必ずベースのレイヤー (L0) に戻る。',
        'LED の色でいまのレイヤーがわかる。',
      ],
      task: read('わかった'),
    },
    {
      id: 'numbers',
      chapter: '4. レイヤー',
      title: `数字 (${numKey} ホールド)`,
      body: `
        <p><b>${numKey} を押したまま</b>上の段を押すと数字になります。左手が 1〜5、右手が 6〜0 です。</p>
        <p>${numKey} は右親指なので、左手の数字は打ちやすく、右手の数字は少し慣れが必要です。</p>`,
      view: k.numLayer === undefined ? undefined : view(k.numLayer, [[k.numKey, 'hold']]),
      tips: [`「1」のつもりが「q」になる → ${numKey} を押すのが遅いか、先に離している。${numKey} を先に、しっかり。`],
      task: type(['123', '4567890', '2026', '1 2 3']),
    },
    {
      id: 'brackets',
      chapter: '4. レイヤー',
      title: `カッコ (${numKey} ホールド)`,
      body: `
        <p>同じく <b>${numKey} を押したまま</b>で、カッコが出せます。</p>
        <ul>
          <li>左手 D / F の位置 → <code>[</code> <code>]</code></li>
          <li>右手 J / K の位置 → <code>(</code> <code>)</code></li>
          <li>右端 → <code>\\</code> と <code>|</code></li>
        </ul>
        <p><code>{ }</code> は Shift も一緒に押します。[ は左手のキーなので右下の Shift を使い、「${numKey} と右下の Shift を押さえて、[ を押す」です。</p>`,
      view: k.numLayer === undefined ? undefined : view(k.numLayer, [[k.numKey, 'hold']]),
      task: type(['()', '[]', 'f(x)', 'a[0]', '{}']),
    },
    {
      id: 'symbols',
      chapter: '4. レイヤー',
      title: `記号 (${symKey} ホールド)`,
      body: `
        <p><b>${symKey} を押したまま</b>だと記号のレイヤーです。上の段は、普通のキーボードで Shift + 数字で出る記号
        (<code>! @ # $ % ^ &amp; *</code>) が同じ順番で並んでいます。</p>
        <p>中の段の左に <code>\` ~ " '</code>、右に <code>= +</code>、下の段は F1〜F12 です。</p>`,
      view: k.symLayer === undefined ? undefined : view(k.symLayer, [[k.symKey, 'hold']]),
      tips: [`${symKey} が入力されてしまう → ${symKey} をすぐ離している。押さえたまま記号キーを押す。`],
      task: type(['!?', '@#$%', 'a-b_c', 'x = y + 1', `"hi" 'yo'`, '~/`']),
    },
    {
      id: 'arrows',
      chapter: '4. レイヤー',
      title: '矢印と移動 (英数 / かな ホールド)',
      body: `
        <p><b>英数 か かな を押したまま</b>にすると、右手が矢印キーになります (I が ↑、J K L が ← ↓ →)。
        英数とかなはどちらを押しても同じです。右手で矢印を使うときは<strong>左親指の英数</strong>を押さえると楽です。</p>
        <p>Mac では、行の先頭・末尾への移動は <b>⌘←</b> / <b>⌘→</b> です。このレイヤーの左手 S / D に入っています
        (右手の Home / End は Mac では「ページの先頭 / 末尾」になるので、文章の編集では ⌘← / ⌘→ を使います)。</p>
        <p>左手側にはほかに、<b>E</b> にスクリーンショット (⌘⇧4)、<b>T</b> に Mission Control、<b>F / G</b> にデスクトップの切り替え (⌃← / ⌃→) が入っています。</p>
        <p class="note">赤い ⌃Tab / ⌃⇧Tab (R と W の位置) を押すとブラウザのタブが切り替わってしまうので、このページでは押さないでください。</p>`,
      tips: [
        '押しっぱなしのつもりが英数/かなが切り替わるだけ → 0.2 秒以上しっかり押さえてから矢印キーを押す。',
        'このレイヤーから戻れなくなったと感じたら、英数 か かな をタップすれば L0 に戻る。',
      ],
      task: press([
        ...(
          [
            ['↑', 'ArrowUp', k.up],
            ['↓', 'ArrowDown', k.down],
            ['←', 'ArrowLeft', k.left],
            ['→', 'ArrowRight', k.right],
            ['Delete', 'Delete', k.del],
          ] as const
        ).map(([name, code, f]) => pressFound(`英数を押したまま <b>${name}</b>`, f, [code], navWarn)),
        pressFound('英数を押したまま <b>⌘←</b> (行の先頭へ)', k.lineStart, ['Meta+ArrowLeft'], navWarn),
        pressFound('英数を押したまま <b>⌘→</b> (行の末尾へ)', k.lineEnd, ['Meta+ArrowRight'], navWarn),
      ]),
    },

    // ================= 5. マウス =================
    {
      id: 'click-left',
      chapter: '5. マウス',
      title: '左クリック',
      body: `
        <p>マウスのクリックは <b>${symKey} を押したまま</b>、右手の H J K で行います。</p>
        <ul>
          <li>J → 左クリック</li>
          <li>K → 右クリック</li>
          <li>H → 中クリック</li>
        </ul>
        <p>ボールでカーソルを下の枠に合わせて、<b>${symKey} を押したまま J</b> を押してください。</p>`,
      tips: [`${symKey} が入力されるだけ → ${symKey} をしっかり押さえてから J を押す。`, `「j」が入力される → ${symKey} を押すのが J より遅い。`],
      task: click(0, layerView(k.mb1)),
    },
    {
      id: 'click-right',
      chapter: '5. マウス',
      title: '右クリック',
      body: `<p><b>${symKey} を押したまま K</b> で右クリックです。メニューを出したいときに使います。</p>`,
      task: click(2, layerView(k.mb2)),
    },
    {
      id: 'click-middle',
      chapter: '5. マウス',
      title: '中クリック',
      body: `<p><b>${symKey} を押したまま H</b> で中クリック (ホイールクリック) です。ブラウザでリンクを新しいタブで開くときに便利です。</p>`,
      task: click(1, layerView(k.mb3)),
    },
    {
      id: 'drag',
      chapter: '5. マウス',
      title: 'ドラッグ',
      body: `
        <p>ドラッグは「クリックを押したまま動かす」操作です。</p>
        <ol>
          <li>カーソルを「持ち上げて」に合わせる</li>
          <li><b>${symKey} と J を押したまま</b>にする</li>
          <li>そのままボールを転がして「ここに置く」まで運ぶ</li>
          <li>J を離す</li>
        </ol>
        <p>左手の親指で ${symKey}、右手の人差し指で J を押さえたまま、右手の親指でボールを転がします。最初は難しいのでゆっくりどうぞ。</p>`,
      tips: [`途中で落ちる → J か ${symKey} が離れている。両方を最後まで押さえておく。`],
      task: drag(layerView(k.mb1)),
    },
    {
      id: 'scroll',
      chapter: '5. マウス',
      title: 'ボールでスクロール',
      body: `
        ${pointing && scrollLayer === undefined ? '<p>読み込んだ overlay には利用できるスクロールレイヤーがありません。ファームウェアの設定を確認してください。</p>' : `<p><b>${scrollInstruction}</b>ボールを転がすと、カーソルは動かずに<strong>画面がスクロール</strong>します。
        縦にも横にもスクロールできます。左手のノブでも縦スクロールできるので、使いやすい方を使ってください。</p>`}`,
      view: scrollLayer === undefined ? undefined : view(scrollLayer, [[scrollKey, 'hold']]),
      tips: [
        `カーソルが動くだけでスクロールしない → ${scrollInstruction}、ボールを転がす。${pointing === undefined ? ' overlay が無いので、矢印のレイヤーをスクロール用と仮定しています。' : ''}`,
        '上下も左右も逆に感じる → Mac の「ナチュラルなスクロール」設定で変えられる。',
        '左右だけ (または上下だけ) 逆に感じる → 下の判定結果を見てください。',
      ],
      task: pointing && scrollLayer === undefined ? read() : scrollAxes(
        `${scrollInstruction}、指示の向きにボールを転がしてください (それぞれ少しずつで OK)。`,
        `直すにはファームウェアの設定を変えます: <a href="${REPO_URL}/blob/main/boards/shields/mona2/mona2_r.overlay" target="_blank" rel="noreferrer">mona2_r.overlay</a> の
        <code>scroller</code> の <code>&amp;zip_scroll_transform</code> で、左右だけ逆なら ${scrollFix('X', pointing?.scrollInvertX)}、上下だけ逆なら ${scrollFix('Y', pointing?.scrollInvertY)}。変更してコミット →
        GitHub Actions のビルドが終わったら<b>右手側だけ</b>書き込み直します。`,
      ),
    },

    // ================= 6. Bluetooth とカスタマイズ =================
    {
      id: 'bluetooth',
      chapter: '6. Bluetooth とカスタマイズ',
      title: 'Bluetooth (英数 + かな ホールド)',
      body: `
        <p><b>英数 と かな を両方押しっぱなし</b>にすると Bluetooth のレイヤーになります。
        ここは試しに押す必要はありません。読んで場所だけ覚えてください。</p>
        <ul>
          <li>右手上段 (Y U I O P の位置) → <b>BT 0〜4</b>: 接続先の切り替え。最大 5 台登録できる</li>
          <li>右手 / の位置 → <b>BT消去</b>: 今選んでいる接続先のペアリングを消す</li>
          <li>右下 Shift の位置 → <b>全消去</b>: 全部のペアリングを消す</li>
        </ul>
        <h3>2 台目の Mac / iPad をつなぐ手順</h3>
        <ol>
          <li>このレイヤーで <b>BT 1</b> を押す (BT 0 は今の Mac)</li>
          <li>新しい機器の Bluetooth 設定から <code>mona2</code> を接続する</li>
          <li>以後は 英数 + かな + BT 0 / BT 1 で切り替えられる</li>
        </ol>
        <h3>つながらなくなったときのやり直し</h3>
        <ol>
          <li>Mac の Bluetooth 設定で <code>mona2</code> を「このデバイスの登録を解除」</li>
          <li>このレイヤーで <b>BT消去</b> (今の接続先を消す)</li>
          <li>もう一度 Mac から接続する</li>
        </ol>
        <p class="danger"><b>赤い Boot キー (真ん中の F15 の位置) は押さないでください。</b>ファームウェアの書き込みモードに入り、キーボードが一時的に使えなくなります。
        押してしまった場合は、電源を入れ直すと元に戻ります。</p>`,
      view:
        k.btLayer === undefined
          ? undefined
          : view(k.btLayer, [
              [k.eisu, 'hold'],
              [k.kana, 'hold'],
              ...k.btSel.map((p): [number, Mark] => [p, 'target']),
              [k.btClr, 'shift'],
              [k.btClrAll, 'shift'],
              [k.bootloader, 'warn'],
            ]),
      task: read(),
    },
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
        <h3>リポジトリのキーマップを編集する</h3>
        <p><a href="${REPO_URL}/blob/main/config/mona2.keymap" target="_blank" rel="noreferrer">config/mona2.keymap</a> を編集してコミットすると、
        GitHub Actions がファームウェアを作ってくれます。キー配置の変更だけなら<b>右手側だけ</b>書き込めば OK で、settings_reset も不要です。
        トラックボールの向きなど、キー配置以外の設定を変えたいときもこちらです。</p>
        <p class="note">このアプリの画面はリポジトリのキーマップを元にしています。ZMK Studio で変えた内容はアプリには反映されないので、
        アプリのヒントと合わせたい場合はリポジトリ側を編集してください。</p>`,
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
          <dd>${numKey} や ${symKey} を押したまま次のキーを押しています。親指キーは短く押してすぐ離す。</dd>
          <dt>左手側だけ反応しない</dt>
          <dd>両方の電源を切って、<b>左 → 右</b> の順に入れ直す。</dd>
          <dt>全く反応しない</dt>
          <dd>Mac の Bluetooth 設定を確認。だめなら「Bluetooth」のレッスンのやり直し手順へ。</dd>
          <dt>急にキーボードが使えなくなった (Finder に USB ドライブが出てきた)</dt>
          <dd>Boot キーを押してしまっています。電源を入れ直せば元に戻ります。</dd>
          <dt>キー配置を変えたい</dt>
          <dd>ZMK Studio か、リポジトリのキーマップを編集します (「キー配置を変えるには」を参照)。</dd>
        </dl>
        <p>あとは「自由練習」で毎日少しずつ打てば、すぐに慣れます。</p>`,
      task: read('完了!'),
    },
  ];
  return lessons.map((l) => ({ ...l, missing: missingIn(km, l.task) }));
}
