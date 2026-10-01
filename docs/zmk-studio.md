# ZMK Studio 経由で実機からキーマップを読む (調査メモ)

Issue #2 の調査結果です。コードは変更していません。調査日は 2026-10-01 で、ZMK v0.3 (`v0.3-branch`)、`zmk-studio-ts-client` 0.0.18、`zmk-studio-messages` の main を読みました。実機での接続テストはしていません (ソースとドキュメントからの判断です)。

## 結論

- **読めます。** ZMK Studio の RPC には読み取り用の `keymap.get_keymap` (レイヤーと bindings) と `keymap.get_physical_layouts` (キーの物理配置) があり、ブラウザからは公式の `@zmkfirmware/zmk-studio-ts-client` (MIT) で呼べます。
- **moNa2 は今のファームのままで使えるはずです。** `~/zmk-config-moNa2-v2` では central (右手側 `mona2_r`) に `studio-rpc-usb-uart` スニペットと `CONFIG_ZMK_STUDIO=y` がすでに入っていて、`CONFIG_ZMK_STUDIO_LOCKING=n` でロックも無効です。
- **Mac で使えるのは Chrome / Edge + USB 接続だけです。** BLE 経由の Web 版は Linux のみと公式ドキュメントに書かれていて、Safari と Firefox は Web Serial を持っていません。
- **`keyboard.json` 相当には変換できますが、変換表が 2 つ要ります。** 実機から来るのは「ビヘイビアの番号と数値パラメータ」なので、(1) ビヘイビア名 → `kp` / `lt` などの短い名前、(2) HID usage の数値 → `Q` / `LSHIFT` などのキーコード名、の対応を持つ必要があります。コンボとエンコーダーは RPC で取れないので、`.keymap` 由来のものを使い続けることになります。
- **推奨:** #1 の入力手段に「実機から読み込む (Chrome + USB)」として**追加する価値はあります**。ただし優先度は「`.keymap` を貼る / 選ぶ」より後です。理由は「推奨」の節に書きました。

## 1. 仕組み

ZMK Studio はキーボード側の RPC サーバーと、それを呼ぶクライアント (zmk.studio の Web アプリやネイティブアプリ) でできています。

- メッセージは Protocol Buffers で定義されています (`zmk-studio-messages/proto/zmk/*.proto`)。
- 通信路は 2 つです。
  - **USB シリアル (CDC-ACM)**: ブラウザでは Web Serial (`navigator.serial.requestPort()`) を使います。ts-client は `baudRate: 12500` で開いています。
  - **BLE GATT**: ブラウザでは Web Bluetooth を使います。サービス UUID は `00000000-0196-6107-c967-c5cfb1c2482a`、RPC キャラクタリスティックは `00000001-0196-6107-c967-c5cfb1c2482a` です。
- ts-client は `connect()` (serial / gatt) で `RpcTransport` を作り、`create_rpc_connection()` と `call_rpc(conn, { keymap: { getKeymap: true } })` のように呼びます。依存は `protobufjs` と `async-mutex` だけで、ESM なので Vite でそのまま使えるはずです。

### 読み取りに使う RPC

| RPC | 返すもの | ロック中に呼べるか |
| --- | --- | --- |
| `core.get_device_info` | 名前、シリアル番号 | 呼べる |
| `core.get_lock_state` | `LOCKED` / `UNLOCKED` | 呼べる |
| `behaviors.list_all_behaviors` | ビヘイビアの local id の一覧 | 呼べる |
| `behaviors.get_behavior_details` | id、`display_name`、パラメータの説明 | **解除が必要** |
| `keymap.get_keymap` | レイヤー (id・名前・bindings) | **解除が必要** |
| `keymap.get_physical_layouts` | 物理配置 (x, y, w, h, 回転) | **解除が必要** |

(ZMK v0.3 の `app/src/studio/*_subsystem.c` の `ZMK_RPC_SUBSYSTEM_HANDLER(..., ZMK_STUDIO_RPC_HANDLER_SECURED / UNSECURED)` から読み取りました。)

書き込み系 (`set_layer_binding`、`save_changes` など) もありますが、このアプリでは**呼びません**。読むだけにします。

## 2. moNa2 で Studio を有効にするのに要るもの

公式ドキュメントの要件と、`~/zmk-config-moNa2-v2` (コミット `1fe913d` 時点) の状態を並べます。

| 要件 | moNa2 の状態 |
| --- | --- |
| `CONFIG_ZMK_STUDIO=y` | `config/mona2_r.conf` にあり ✅ |
| `studio-rpc-usb-uart` スニペット | `build.yaml` の `mona2_r` に `snippet: studio-rpc-usb-uart` あり ✅ |
| 分割キーボードでは **central 側だけ**に設定 | central は右手 (`Kconfig.defconfig` で `SHIELD_MONA2_R` に `ZMK_SPLIT_ROLE_CENTRAL`)。右手だけに入っている ✅。公式の例は「central/left」と書いていますが、要は central 側です |
| `keys` つきの物理レイアウトがあり、`chosen` の `zmk,matrix-transform` を使わない | `mona2.dtsi` で `zmk,physical-layout = &physical_layout0` と `keys` を定義 ✅ |
| BLE 経由で使うなら `CONFIG_ZMK_STUDIO_TRANSPORT_BLE` | `ZMK_BLE` が有効なら既定で `y` ✅ (ただし Mac のブラウザからは使えません。後述) |
| ロックの解除手段 | `CONFIG_ZMK_STUDIO_LOCKING=n` でロック自体が無効 ✅ |

つまり **moNa2 側のファーム変更は要りません。** 他のキーボード向けに一般化するなら、上の表がそのまま「Studio 対応しているか」のチェックリストになります。

補足:

- レイヤー名は `.keymap` の `display-name` から来ます。moNa2 の `.keymap` には `display-name` がないので、実機から来る名前はノード名 (`default_layer`、`layer_1` …) になるはずです (`zmk_keymap_layer_name()` の既定の挙動)。今の `keyboard.json` の `name` と同じ形です。
- USB と BLE の両方につないでいるときは、出力先を Studio と同じ経路 (USB なら `&out OUT_USB`) にするよう公式ドキュメントに注意があります。moNa2 の L4 には `&out` が見当たらないので、USB で読むときは BT 接続を切るなどの案内が要るかもしれません (未検証)。

## 3. ロックの解除手順

ロックが有効なファーム (`CONFIG_ZMK_STUDIO_LOCKING=y`、既定値) では、`get_keymap` などを呼ぶ前にキーボードの物理キーで解除してもらう必要があります。

1. キーマップのどこかに `&studio_unlock` ビヘイビアを置いてビルドしておく
2. アプリが `core.get_lock_state` で `LOCKED` を確認したら、「キーボードの Studio Unlock キーを押してください」と表示する
3. ユーザーがそのキーを押すと `core.lock_state_changed` 通知で `UNLOCKED` が届くので、そこから読み取りを始める
4. 一定時間 (既定 500 秒、`CONFIG_ZMK_STUDIO_LOCK_IDLE_TIMEOUT_SEC`) 操作がないか、切断すると (`CONFIG_ZMK_STUDIO_LOCK_ON_DISCONNECT`、既定 `y`) 再びロックされる

moNa2 は `CONFIG_ZMK_STUDIO_LOCKING=n` なのでこの手順は不要です。ただし、これは「USB をつないだアプリなら誰でもキーマップを書き換えられる」状態でもあるので、ドキュメントや README で勧める設定ではありません。

## 4. 得られるデータの形と `keyboard.json` への変換

### 実機から来るもの

```proto
message Keymap { repeated Layer layers = 1; uint32 available_layers = 2; uint32 max_layer_name_length = 3; }
message Layer { uint32 id = 1; string name = 2; repeated BehaviorBinding bindings = 3; }
message BehaviorBinding { sint32 behavior_id = 1; uint32 param1 = 2; uint32 param2 = 3; }
message KeyPhysicalAttrs { sint32 width = 1; sint32 height = 2; sint32 x = 3; sint32 y = 4; sint32 r = 5; sint32 rx = 6; sint32 ry = 7; }
```

- `behavior_id` は**ファームごとの local id** で、固定の番号ではありません。`get_behavior_details(id)` で `display_name` を引いて名前に直します。
- `display_name` はビヘイビアの devicetree の `display-name` で、なければノード名になります (`DT_PROP_OR(node_id, display_name, DEVICE_DT_NAME(node_id))`)。
- `param1` / `param2` は数値です。キーコードは HID usage で、`(usage_page << 16) | usage_id` に、上位 8 ビットに暗黙のモディファイア (`LS(...)` など) が乗ります。ZMK の `dt-bindings/zmk/keys.h` と同じ表現です。レイヤー番号のパラメータはレイヤーの **id** (並べ替えても変わらない番号) です。

### 今の `keyboard.json` の形

```ts
{ behavior: "kp", params: ["Q"] }          // Binding
{ name: "default_layer", bindings: [...] } // Layer
{ x, y, w, h }                             // キー (1u = 1)
```

### 対応表

| 実機の値 | `keyboard.json` での形 | 変換 |
| --- | --- | --- |
| `display_name: "Key Press"` + `param1: 0x00070014` | `{ behavior: "kp", params: ["Q"] }` | ビヘイビア名表 + HID usage → キーコード名の逆引き表 |
| `"Layer-Tap"` + `param1: レイヤー id` + `param2: HID usage` | `{ behavior: "lt", params: ["2", "ENTER"] }` | レイヤー id → 並び順の番号、HID usage → 名前 |
| `"Mod-Tap"` | `mt` | 両方のパラメータが HID usage |
| `"Momentary Layer"` / `"To Layer"` | `mo` / `to` | レイヤー id → 番号 |
| `"Transparent"` / `"None"` | `trans` / `none` | パラメータなし |
| `"Mouse Key Press"` | `mkp` | ボタンのビット値 → `LCLK` など |
| `"Bluetooth"` / `"Bootloader"` | `bt` / `bootloader` | `bt` のコマンド番号 → `BT_SEL` など |
| `display-name` のないビヘイビア (`lt_to_layer_0`、`mouse_scroll` など) | `lt_to_layer_0`、`msc` | ノード名で来る。`&msc` のようにラベルとノード名が違うものは個別に対応 |
| `KeyPhysicalAttrs` (`width: 100` など) | `{ w: 1, ... }` | 100 で割る。`mona2.dtsi` も 100 = 1u なので一致 |

変換できるかについての判断:

- **できます。** moNa2 で使っているビヘイビア (`kp`、`lt`、`mt`、`mo`、`to`、`trans`、`mkp`、`bt`、`bootloader`、自作の `lt_to_layer_0`) はすべて名前で見分けられます。
- **新たに要るもの:**
  1. HID usage → ZMK キーコード名の逆引き表。`src/lib/keycodes.ts` は名前 → 文字の表なので、`keys.h` 相当の名前 → 数値の表を足して逆引きします。別名 (`RET` と `ENTER` など) は 1 つに寄せます。
  2. `display_name` → 短いビヘイビア名の表。`display_name` は表示用の文字列なので、ZMK の版で変わる可能性があります。
- **取れないもの:**
  - **コンボ** (`combos`)。Studio はまだ対応していません (公式の機能表で「Planned」)。moNa2 の L4 (英数+かな) と Tab のコンボは `.keymap` から取るか、ユーザーに確認する必要があります。
  - **エンコーダー (sensor-bindings)**。こちらも「Low Priority」です。
  - **ビヘイビアの設定値** (hold-tap の `tapping-term-ms` など)。今のアプリは使っていないので問題ありません。
- **ずれる可能性:** 公式ドキュメントにあるとおり、Studio で一度保存すると、以後 `.keymap` の変更は「Restore Stock Settings」をしない限り反映されません。#2 の背景 (「`.keymap` と実機がずれる」) はまさにこのケースで、実機から読む意味があるのはここです。

## 5. ライセンス

| リポジトリ | ライセンス | 使い方 |
| --- | --- | --- |
| `zmkfirmware/zmk-studio-ts-client` (npm `@zmkfirmware/zmk-studio-ts-client`) | MIT | 依存として入れる。MIT なので問題なし |
| `zmkfirmware/zmk-studio-messages` (`.proto`) | MIT | ts-client に生成済みのコードが含まれるので、直接は使わない |
| `zmkfirmware/zmk` (`keys.h` など) | MIT | キーコード表を写すなら、出典とライセンス表記を残す |
| `zmkfirmware/zmk-studio` (Web アプリ本体) | Apache-2.0 | コードは写さず、挙動 (HID usage の扱いなど) の参考に留める |

## 6. ブラウザ対応 (Mac)

| ブラウザ | USB (Web Serial) | BLE (Web Bluetooth) |
| --- | --- | --- |
| Chrome / Edge (デスクトップ) | ✅ 使える | ❌ ZMK 公式では BLE の Web 版は Linux のみ |
| Safari | ❌ Web Serial なし | ❌ Web Bluetooth なし |
| Firefox | ❌ Web Serial なし | ❌ Web Bluetooth なし |

- Web Serial は安全なコンテキスト (https か localhost) で、ボタンを押したときなどユーザー操作の中で `requestPort()` を呼ぶ必要があります。
- BLE は公式の機能表に「Making changes while connected via BLE (Linux web-app & native apps only)」とあります。Mac の Chrome で Web Bluetooth を試すことはできますが、公式に動かないとされているので、このアプリでは USB だけを案内します。
- 使えないブラウザでは `'serial' in navigator` で判定して、ボタンを出さないか「Chrome か Edge で開いてください」と表示します。

## 7. 推奨: #1 の入力手段に足すべきか

**足す価値はあります。ただし #1 の最初の入力手段にはせず、2 番目以降の「おまけ」として足すのを推奨します。**

足す理由:

- Studio で配置を変えた人にとって、実機と練習画面を一致させる確実な方法はこれしかありません。
- moNa2 はファームの変更なしで使えます。
- 読み取りだけなら、ts-client の API を数個呼ぶだけで済みます。

後回しにする理由:

- 使えるのは Chrome / Edge + USB ケーブルのときだけです。Safari の人や、BLE だけで使っている人は使えません。
- コンボが取れないので、どのみち `.keymap` 側の情報 (または手入力) と組み合わせる必要があります。
- HID usage の逆引き表とビヘイビア名の表という、保守が要る表が増えます。
- ロックが有効な一般的なキーボードでは「Studio Unlock キーを押す」という手順を初心者に案内する必要があります。

## 8. 実装するならの手順案

1. **依存を足す:** `bun add @zmkfirmware/zmk-studio-ts-client`。`bun run build` でバンドルサイズを確認し、大きければ「実機から読む」画面だけ動的 import にします。
2. **変換部分を純粋な関数で書く (`src/lib/studio.ts`):** `get_keymap` / `get_physical_layouts` / ビヘイビアの詳細を受け取り、`KeyboardData` を返す関数にします。ブラウザ API に触れないので `bun test` でテストできます。テストは「`.keymap` から作った `keyboard.json` と、同じ配置を表す RPC の応答から作ったものが一致する」形にします (応答は実機から一度取って fixture にします)。
3. **キーコード表:** ZMK の `keys.h` から「名前 → HID usage」の表を作り (`scripts/` に生成スクリプトを置く、出典と MIT 表記つき)、逆引きします。暗黙のモディファイア (上位 8 ビット) は `LS(...)` などに戻します。
4. **ビヘイビア名表:** `display_name` → `kp` / `lt` … の表を持ちます。知らない名前は「不明なキー」として表示し、練習の対象から外します。
5. **接続 UI (`src/ui/`):** 「キーボードから読み込む」ボタン → `serial.connect()` → `get_lock_state` → ロック中なら解除を案内 → 読み取り → 切断、の順に進めます。書き込み系の RPC は呼ばないので、ラッパーには読み取り用の関数だけを用意します。
6. **コンボの扱い:** 実機から読んだときは、コンボを「`.keymap` から取り込んだもの」のまま残すか、空にして「コンボは反映されません」と表示します。これは #1 の設計次第なので、着手時に決めます。
7. **実機で確認:** moNa2 の右手を USB でつなぎ、Chrome で読み込んで今の `keyboard.json` と一致するかを見ます。

## 出典

- ZMK Studio の機能・ビルド方法・分割キーボードの注意・物理レイアウトの要件: <https://zmk.dev/docs/features/studio> (v0.3 の原文: <https://github.com/zmkfirmware/zmk/blob/v0.3-branch/docs/docs/features/studio.md>)
- Studio の Kconfig (ロック、タイムアウト、BLE): <https://zmk.dev/docs/config/studio>、<https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/src/studio/Kconfig>
- `&studio_unlock`: <https://zmk.dev/docs/keymaps/behaviors/studio-unlock>、<https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/dts/behaviors/studio_unlock.dtsi>
- RPC ごとのロック要否: <https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/src/studio/keymap_subsystem.c>、<https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/src/studio/behavior_subsystem.c>、<https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/src/studio/core_subsystem.c>
- ビヘイビア名の既定値 (`display-name` がなければノード名): <https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/include/drivers/behavior.h>
- メッセージ定義: <https://github.com/zmkfirmware/zmk-studio-messages/tree/main/proto/zmk> (`keymap.proto`、`behaviors.proto`、`core.proto`、`meta.proto`)
- TypeScript クライアント (MIT): <https://github.com/zmkfirmware/zmk-studio-ts-client> (`src/index.ts`、`src/transport/serial.ts`、`src/transport/gatt.ts`)、npm: <https://www.npmjs.com/package/@zmkfirmware/zmk-studio-ts-client>
- Web アプリ (Apache-2.0、HID usage の扱い `src/hid-usages.ts`): <https://github.com/zmkfirmware/zmk-studio>
- ZMK のキーコード定義 (MIT): <https://github.com/zmkfirmware/zmk/blob/v0.3-branch/app/include/dt-bindings/zmk/keys.h>
- Web Serial のブラウザ対応: <https://developer.mozilla.org/ja/docs/Web/API/Web_Serial_API>
- Web Bluetooth のブラウザ対応: <https://developer.mozilla.org/ja/docs/Web/API/Web_Bluetooth_API>
