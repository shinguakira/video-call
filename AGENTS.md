# AGENTS.md — AI エージェント向けガイド

このファイルは Claude Code などの AI エージェントがこのリポジトリを理解するためのドキュメントです。

## プロジェクト概要

WebRTC P2P ビデオ通話の PoC。ブラウザ間の映像・音声ストリームを直接転送し、シグナリングのみ Socket.IO サーバーを経由する。

## 技術スタック

- **Next.js 16** App Router（`src/app/`）
- **React 19** + TypeScript 5
- **Tailwind CSS v4** + shadcn/ui（`src/components/ui/`）
- **simple-peer** — WebRTC のラッパー（`useWebRTC.ts` で使用）
- **Socket.IO** — シグナリングサーバー・チャット中継
- **Playwright** — E2E テスト（`e2e/`）
- **oxlint** — 高速リンター
- **oxfmt** — 高速フォーマッター（Prettier 互換）

## ディレクトリマップ

```
video-call/
├── e2e/                    # Playwright E2E テスト
│   ├── helpers.ts          # モックユーティリティ
│   ├── home.spec.ts
│   ├── lobby.spec.ts
│   └── room.spec.ts
├── src/
│   ├── app/
│   │   ├── page.tsx              # / ランディング
│   │   ├── lobby/page.tsx        # /lobby?roomId=
│   │   ├── room/[roomId]/page.tsx # /room/:id?name=
│   │   ├── api/socket/io/route.ts # Socket.IO API route（開発用）
│   │   └── globals.css
│   ├── components/
│   │   ├── chat/ChatPanel.tsx
│   │   ├── video/ControlPanel.tsx
│   │   ├── video/VideoGrid.tsx
│   │   ├── video/VideoTile.tsx
│   │   └── ui/               # shadcn/ui コンポーネント
│   ├── hooks/
│   │   ├── useMediaStream.ts # getUserMedia / 画面共有
│   │   ├── useSocket.ts      # Socket.IO 接続
│   │   └── useWebRTC.ts      # P2P ピア接続管理
│   └── lib/
│       ├── socket.ts         # Socket.IO クライアント シングルトン
│       └── utils.ts          # cn() ユーティリティ
├── server.js               # 独立シグナリングサーバー（port 4001）
├── playwright.config.ts
├── .oxlintrc.json
└── package.json
```

## 重要な設計上の決定

### シグナリングフロー

1. ブラウザが Socket.IO でサーバーに `join-room` を送信
2. サーバーは既存ユーザーに `user-joined`、新規ユーザーに `existing-users` を送信
3. ブラウザ間で simple-peer が offer/answer/ICE candidate を `signal` イベントで交換
4. ICE ネゴシエーション完了後、P2P で映像・音声ストリームを直接転送

### state 管理

- グローバルストアなし（Redux/Zustand 不使用）
- `useWebRTC` → `peersRef`（`Map<userId, SimplePeer.Instance>`）で接続を管理
- `setPeers` で React state を更新してレンダリングをトリガー
- ローカルストリームが変わったとき（画面共有）は `replaceTrack()` で全ピアのトラックを差し替え

### Socket.IO シングルトン

`src/lib/socket.ts` はモジュールレベルで Socket インスタンスを保持。
ページ遷移しても再接続されない設計。

## ネット接続の問題点

E2E テスト（`e2e/room.spec.ts` の "Network failure documentation"）で確認済み。

### 1. シグナリング URL のハードコード（最重要）

```typescript
// src/lib/socket.ts:7
socket = io('http://localhost:4001', { autoConnect: true });
```

**問題**: ローカルホスト以外からアクセスするとシグナリングサーバーに到達できない。  
**修正方針**: 環境変数 `NEXT_PUBLIC_SIGNALING_URL` で上書き可能にする。

```typescript
// 修正例
socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL ?? 'http://localhost:4001');
```

### 2. STUN/TURN サーバー未設定

```typescript
// src/hooks/useWebRTC.ts:82 と 138
const peer = new SimplePeer({
  initiator: true,
  stream: streamRef.current,
  trickle: true,
  // ← ICE servers が未指定
});
```

**問題**: NAT 越えができない。同一 LAN や localhost のみで動作。  
**修正方針**: `config` に ICE サーバーを追加。

```typescript
config: {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // 本番では TURN サーバーも必要
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
  ],
},
```

### 3. HTTP のみ（HTTPS なし）

**問題**: ブラウザは `getUserMedia()` を安全なコンテキスト（HTTPS または localhost）でのみ許可。  
**修正方針**: 本番デプロイ時は HTTPS を使用する。

### 4. CORS ワイルドカード

```javascript
// server.js:6-9
cors: {
  origin: '*',  // 本番では制限が必要
}
```

### 5. チャットの永続化なし

Socket.IO でリレーするのみ。サーバー再起動やユーザー退出でメッセージが消える。

## コードを変更するときの注意

- **ピア接続の追加・削除**: `useWebRTC.ts` の `peersRef` と `setPeers` は必ず両方更新すること。片方だけ更新すると UI とピアの実体が乖離する。
- **getUserMedia のモック**: `--use-fake-device-for-media-stream` フラグが `playwright.config.ts` で設定済み。テスト内で別途モックは不要。
- **Socket.IO イベント**: `server.js` と `api/socket/io/route.ts` は同じロジックを持つ二重管理。`server.js`（port 4001）が開発で使用される実体。

## 開発手順

```bash
# シグナリングサーバー（port 4001）
node server.js

# Next.js 開発サーバー（port 3000）
npm run dev

# E2E テスト（サーバー不要、Playwright が Next.js を起動）
npm run test:e2e

# リント
npm run lint:ox

# フォーマット（自動適用）
npm run fmt
```

## テスト戦略

| テスト種別 | ツール | 対象 |
|---|---|---|
| E2E UI テスト | Playwright | ページ遷移・フォーム・ローディング状態 |
| ネットワーク障害確認 | Playwright | socket URL ハードコード・接続失敗の記録 |
| 単体テスト | 未設定 | hooks/utils の単体テストは今後追加推奨 |

## 現在の実装状態

| 機能 | 状態 |
|---|---|
| P2P ビデオ通話（ローカル） | ✅ 動作 |
| 音声ミュート / カメラオフ | ✅ 動作 |
| 画面共有 | ✅ 動作 |
| チャット（同一セッション） | ✅ 動作 |
| ネット越し P2P | ❌ STUN/TURN 未設定で失敗 |
| リモートシグナリング | ❌ localhost ハードコードで失敗 |
| HTTPS 対応 | ❌ 未設定 |
| 録画 | ❌ 未実装 |
| 帯域適応 / 品質制御 | ❌ 未実装 |
