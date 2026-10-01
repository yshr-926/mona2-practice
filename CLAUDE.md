# mona2-practice

moNa2 (自作分割キーボード, ZMK) の初心者向けステップバイステップ教習 Web アプリ + タイピング練習。**Mac 専用** (Windows 対応はしない)。Vite + TypeScript (フレームワークなし)。パッケージ管理・スクリプト実行・テストは bun (npm は使わない)。

## 構成

- `scripts/sync-keymap.ts` — zmk-config からキーマップと物理配置を読み `src/data/keyboard.json` を生成 (bun で直接実行)
- `src/lib/zmk.ts` — `.keymap` / `.dtsi` の簡易パーサ (moNa2 の設定が読めれば十分という割り切り)
- `src/lib/keycodes.ts` — ZMK キーコード → US 配列の文字、表示ラベル
- `src/lib/layout.ts` — 文字 → 押すキーの組 (`Stroke`: 文字キー + レイヤーキー + Shift キー) の解決
- `src/lessons/index.ts` — レッスン本文と課題の並び。キー位置は `keyPositions()` でキーマップから引く
- `src/lessons/tasks.ts` — 課題の種類 (キーを押す / 全キーテスト / トラックボール / ホイール / クリック / ドラッグ / 文字入力)。入力イベントを見て `ctx.complete()`
- `src/ui/` — キーボード図、入力モニター、文字入力部品 (レッスンと自由練習で共用)
- `src/main.ts` — 目次・ルーティング (`#/lesson/<id>`, `#/practice`)・ページ全体のキー無効化
- `src/practice.ts` + `src/drills.ts` + `src/stats.ts` — 自由練習

## キーマップの前提 (2026-09 時点)

- 対象は `~/zmk-config-moNa2-v2` (yshr-926/zmk-config-moNa2-v2, ZMK v0.3)
- 42 キー。L1 = Space ホールド (数字・括弧), L2 = Enter ホールド (記号・F キー・クリック H/J/K), L3 = 英数/かなホールド (矢印・⌘←→・ボールでスクロール), L4 = 英数+かな コンボのホールド (BT・Boot)
- Shift は右下の角と Z キーの mod-tap。練習のヒントは打つ文字と反対の手の Shift を選ぶ
- 左下は MacBook と同じ ⌃ ⌥ ⌘ の順、右下は Shift。中央の列は Tab / ⌃← / ⌃→ (2026-09-24 に Mac 向けに変更)。L3 の E = ⌘⇧4、T = ⌃↑、F/G = ⌃←/⌃→
- ⌃←/⌃→/⌃↑ や F14/F15 のように macOS が先に受け取るキーはブラウザに届かない (実機で確認済み)。`SYSTEM_SHORTCUTS` に登録し、キーテストやレッスンでは画面の変化を自己申告してもらう
- `&trans` はベースレイヤーへ落ちるものとして扱う
- キー判定は `KeyboardEvent.code` で行う (IME に左右されない)。文字入力の課題だけ `e.key`
- レッスン文はこのキーマップ前提で書いてある。キーマップを変えて `lessons.test.ts` が落ちたら文章も直す

## 開発

- 元のキーマップ: `~/zmk-config-moNa2-v2` (編集はそちらで行い、ここでは `bun run sync-keymap` で取り込むだけ)
- 変更後は `bun test` と `bun run build` を通す
- コメント・UI 文言は日本語
