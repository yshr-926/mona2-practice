# moNa2 教習所 (mona2-practice)

自作キーボード **moNa2** (左右分割・右手トラックボール・左手ノブ、ZMK) の使い方を、ステップバイステップで覚えるための Web アプリです。
レッスンのあとはタイピングの自由練習もできます。**Mac 専用**です。

私自身、moNa2 で初めて分割キーボードと 40% キーボードに挑戦しました。
キーが少ない、親指でレイヤーを切り替える、トラックボールでマウス操作をする、と最初は戸惑うことばかりです。
このアプリは、同じように **moNa2 から分割キーボードや 40% キーボードを始める初心者**向けに作っています。

実際のキーマップ ([yshr-926/zmk-config-moNa2-v2](https://github.com/yshr-926/zmk-config-moNa2-v2)) を読み込み、
押すべきキーをキーボード図の上で光らせながら、実際の入力を見て 1 ステップずつ判定します。

## moNa2 の製作者のおふたりについて

moNa2 は、**白湯_sayu さん** ([@Pooh_pol0](https://x.com/Pooh_pol0)) と **shakupan さん** ([@shakupan\_](https://x.com/shakupan_)) が製作されているキーボードです。
素敵なキーボードを世に送り出してくださったおふたりに、心から感謝しています。

このアプリは**非公式のファンメイド**です。
アプリについてのご質問や不具合は、製作者のおふたりではなく、このリポジトリの [Issues](https://github.com/yshr-926/mona2-practice/issues) へお寄せください。

## レッスン (全 26)


| 章                    | 数   | 内容                                                                                        |
| -------------------- | --- | ----------------------------------------------------------------------------------------- |
| 1. はじめに              | 2   | 使い方 / 電源と接続 (左 → 右)                                                                       |
| 2. 動作チェック            | 3   | 全 42 キーの反応確認 / トラックボールの向き / ノブ                                                            |
| 3. 基本の打ち方            | 8   | ホームポジション / 親指キー / 英数・かな / 単語 / Shift / 同時押し (Tab・Esc) / Cmd・Ctrl・Option / デスクトップとアプリの切り替え |
| 4. レイヤー              | 5   | しくみ / 数字・カッコ (Space ホールド) / 記号 (Enter ホールド) / 矢印と ⌘←→ (英数ホールド)                            |
| 5. マウス               | 5   | 左・右・中クリック (Enter + J/K/H) / ドラッグ / ボールでスクロール (縦横の向きがそろっているかも判定)                           |
| 6. Bluetooth とカスタマイズ | 2   | BT の切り替え / ZMK Studio・リポジトリでのキー配置変更                                                       |
| 7. 仕上げ               | 1   | 困ったときは                                                                                    |


各レッスンには「うまくいかないときは」があります。よくある失敗 (レイヤーキーがタップ扱いになった、かな入力のまま、など) は
実際の入力から検出して、その場で説明します。画面下の入力モニターには、最後に届いたキー / クリック / ホイールを常に表示します。

## 動作環境

- Mac + Chrome を想定しています (英数/かな キーは `Lang2` / `Lang1` として判定します。Safari 向けに `e.key` でも拾います)
- 記号は US 配列前提です。JIS 配列への対応は [#8](https://github.com/yshr-926/mona2-practice/issues/8) で予定しています
- キーマップは今のところ [yshr-926/zmk-config-moNa2-v2](https://github.com/yshr-926/zmk-config-moNa2-v2) 固定です。
誰のキーマップでも使えるようにする作業は [#13](https://github.com/yshr-926/mona2-practice/issues/13) にまとめています

画面の見方:

- 色: 青 = 押すキー / 緑 = ホールドするキー / 橙 = Shift / 赤 = 押さないで
- 進み具合と文字ごとのミス率は、ブラウザの localStorage に保存されます

## 開発

[bun](https://bun.sh/) を使います。

```sh
bun install
bun run dev          # http://localhost:5173
```


| コマンド                  | 内容                    |
| --------------------- | --------------------- |
| `bun run dev`         | 開発サーバ                 |
| `bun run build`       | 型チェック + ビルド (`dist/`) |
| `bun test`            | テスト (bun:test)        |
| `bun run sync-keymap` | キーマップ同期 (下記)          |


変更したら `bun test` と `bun run build` を通してください。

### キーマップの同期

キーマップの編集は zmk-config 側で行い、ここでは取り込むだけです。

```sh
bun run sync-keymap                        # ~/zmk-config-moNa2-v2 から読む
bun run sync-keymap /path/to/zmk-config    # 別の場所から読む (ZMK_CONFIG_DIR でも可)
```

`config/mona2.keymap` と `boards/shields/mona2/mona2.dtsi` (物理配置) を読み、`src/data/keyboard.json` に書き出します。
この JSON はコミットしておくので、zmk-config が無くてもアプリは動きます。

- ZMK Studio で本体側のキーマップを変えた場合、その変更はここには反映されません (リポジトリの配置を表示します)
- レッスン文はこのキーマップ前提で書いています。キーマップを変えて `src/lessons/lessons.test.ts` が落ちたら、文章も直してください

## 関連リンク

- [moNa 公式サイト](https://sayu-hub.github.io/mona-page/)
- [moNa2 商品紹介 (note)](https://note.com/pooh_polo/n/ncfce62c909f5)
- [moNa2 最新ファームウェア公開 &amp; 製作者のキー設定紹介 (note)](https://note.com/pooh_polo/n/nc88afb19898a)
- [sayu-hub/zmk-config-moNa2](https://github.com/sayu-hub/zmk-config-moNa2) — 商品詳細・注意事項
- [moNa サポート・開発サーバー (Discord)](https://discord.gg/kJjDBDHGer)