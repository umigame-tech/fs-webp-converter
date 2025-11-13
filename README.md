# FS WebP Converter

ローカルディレクトリ内の PNG / JPG / WebP を File System Access API と Canvas だけで相互変換できる Web ツールです。サーバーへファイルを送信しないため、プライバシーを保ちながら圧縮やフォーマット統一を行えます。

## 機能ハイライト
- **ディレクトリ単位の操作**: ブラウザから任意フォルダを選択し、PNG・JPG・WebPをスキャンして件数/サイズを一覧表示。
- **Canvas 経由の変換**: `createImageBitmap` と `<canvas>.toBlob()` を用いてブラウザ内でエンコード。PNG⇄WebP、JPG⇄WebP の双方向に対応。
- **ログと進捗表示**: 変換中のステータスと成功/失敗ログを即時フィードバック。
- **Cloudflare Workers 対応**: React Router v7 + Vite 構成をそのまま Workers へデプロイ可能。

## 必要環境
- Node.js 20+
- Chromium 系ブラウザ (Chrome, Edge, Arc など) ※ File System Access API が必要
- Cloudflare アカウント (Workers へデプロイする場合)

## セットアップ
```bash
git clone <repo-url>
cd fs-webp-converter
npm install
```

## 開発・ビルドコマンド
| コマンド | 説明 |
| --- | --- |
| `npm run dev` | React Router の開発サーバーを起動 (HMR 対応) |
| `npm run typecheck` | `wrangler types` + React Router typegen + `tsc -b` を実行 |
| `npm run build` | 本番ビルドと Workers バンドルを生成 |
| `npm run preview` | 生成済みビルドをローカルサーバーで確認 |
| `npm run deploy` | `build` 後に `wrangler deploy` を実行 |

## 使い方
1. `npm run dev` を起動し、`http://localhost:5173` を Chromium で開く。
2. 「ディレクトリを選択」を押して、変換したい画像が入ったフォルダを選ぶ。初回は読取/書込の権限付与が必要。
3. 一覧に読み込まれたファイルを確認し、目的の変換ボタン (例: `JPG → WebP`) をクリック。
4. 変換が完了すると同ディレクトリ内に新しいファイルが出力され、ログに処理結果が表示される。

## プロジェクト構成
- `app/` – ルーティング、UI、変換ロジックを含む React Router アプリ本体。
- `public/` – `ogp.webp` などの静的アセット。
- `workers/`, `wrangler.jsonc` – Cloudflare Workers のエントリーポイントと設定。
- 主要設定: `vite.config.ts`, `react-router.config.ts`, `tsconfig*.json`

## 注意事項
- File System Access API 非対応ブラウザでは機能しません。
- 大容量画像は Canvas 変換に時間がかかる場合があります。処理中はブラウザタブを閉じないでください。
- 追加形式や品質パラメータを変更したい場合は `app/routes/home.tsx` 内の `DIRECTION_CONFIG` と `canvasToBlob` を編集してください。
