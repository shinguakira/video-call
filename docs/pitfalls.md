# ビデオ通話実装のハマりポイント

WebRTC + Socket.IO + Next.js でビデオ通話を実装する際に実際に踏んだ問題と対策をまとめる。

---

## 1. React Strict Mode による `useEffect` 二重実行

### 症状
- `join-room` イベントがサーバーに2回届く
- 2回目の join を「新規参加」と解釈し、自分自身を `existing-users` に含めて返す
- 自分自身に対して WebRTC Peer を生成しようとしてエラー
- `Failed to set remote answer sdp: Called in wrong state: stable`

### 原因
React 18+ の Strict Mode は開発環境で `useEffect` を「マウント → アンマウント → 再マウント」と2回呼ぶ。同じ socket から `join-room` が2回飛ぶ。

### 対策（server.js）
```javascript
socket.on('join-room', ({ roomId, userId, userName }) => {
  const room = rooms.get(roomId);
  // 同じ userId + 同じ socketId なら2回目の呼び出しなので無視
  if (room.get(userId)?.socketId === socket.id) {
    return;
  }
  // ...通常の join 処理
});
```

---

## 2. `leave-room` の二重送信

### 症状
- ページ離脱時に `leave-room` が2回送信される
- Strict Mode のクリーンアップ関数が2回呼ばれるため

### 対策（useWebRTC.ts）
```typescript
const hasLeftRef = useRef(false);

// クリーンアップ時
if (!hasLeftRef.current) {
  socket.emit('leave-room', { roomId, userId });
}

// 明示的に leave するとき
const markLeft = () => { hasLeftRef.current = true; };
```

---

## 3. WebRTC は STUN/TURN なしでは同一マシン・同一LAN限定

### 症状
- localhost では動くが、異なるネットワーク間で繋がらない
- ICE candidate が集まらず接続が止まる

### 理由
STUN サーバーなしでは外部IPアドレスが判明しない。TURN サーバーなしではNAT越えができない。

### 対策
- 開発・PoC 用途: `localhost` または同一LAN内のみで動作確認
- 本番用途: Google STUN (`stun:stun.l.google.com:19302`) + TURN サーバーを設定

```typescript
// simple-peer に渡す config
const peer = new SimplePeer({
  initiator: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // { urls: 'turn:...', username: '...', credential: '...' }
    ],
  },
});
```

---

## 4. チャットメッセージのリレー: `socket.to()` は送信者自身には届かない

### 仕様
```javascript
socket.to(roomId).emit('chat-message', { ... });
```
これは **送信者以外** の同じ room 内の全 socket に届く。送信者本人には届かない。

### クライアント側の対応（楽観的UI）
送信者はサーバーからの echo を待たず、即座に自分のローカル state に追加する。

```typescript
// 送信と同時にローカルに追加（optimistic update）
socket.emit('chat-message', { roomId, message });
setMessages(prev => [...prev, { userId, userName, message, timestamp: Date.now(), isLocal: true }]);
```

### 注意
サーバー側で `userId` / `userName` を socket→room のマッピングから引く設計にすると、socket が room に登録されていない場合に `userName: 'Guest'` になる。

---

## 5. Socket.IO サーバー再起動後にクライアントが room に未登録になる

### 症状
- サーバーを再起動するとクライアントは auto-reconnect するが、`join-room` を再送しない場合がある
- サーバー側の room map はクリアされているので、既存ユーザーは room に存在しない扱いになる
- 他のユーザーのメッセージが届かない

### 原因
Socket.IO の auto-reconnect は TCP 再接続のみ行う。アプリレベルの `join-room` 再送はアプリ側で実装しなければならない。

### 対策
```typescript
socket.on('reconnect', () => {
  socket.emit('join-room', { roomId, userId, userName });
});
```
または、ページリロードを促す設計にする（PoC レベルなら現実的）。

### E2Eテスト時の注意
Playwright の `globalSetup` がシグナリングサーバーを起動し、`teardown` で kill する。テスト終了後に手動で別クライアントを繋ごうとすると、サーバーが落ちていて `join-room` が飛んでいないのに Connected: Yes と表示されたままになることがある。デモの際は必ずサーバー状態を確認すること。

---

## 6. Playwright: fake media デバイスの設定

### 症状
ヘッドレスブラウザでは `getUserMedia()` が失敗する。

### 対策（`playwright.config.ts`）
```typescript
use: {
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
},
```

- `--use-fake-device-for-media-stream`: 動くグリーンのアニメーション映像を生成
- `--use-fake-ui-for-media-stream`: 権限ダイアログを自動許可

---

## 7. Playwright: アイコンのみのボタンには `aria-label` が必須

### 症状
```typescript
// これは失敗する
page.getByRole('button', { name: /Leave/i })
// → アクセシブルな名前がないので locator が見つからない
```

### 対策
```tsx
<Button aria-label="Leave call" onClick={onLeave}>
  <PhoneOff />
</Button>
```

アイコンのみのボタン全てに `aria-label` を付ける。テスタビリティと a11y を同時に改善できる。

---

## 8. Playwright: セレクタの strict mode 違反

### 症状
```typescript
page.getByText('Alice')
// → 複数の要素（ビデオタイルのバッジ、デバッグオーバーレイ、チャットバブル）にマッチして strict mode エラー
```

### 対策
スコープを絞るか、より具体的なセレクタを使う。

```typescript
// チャットバブルの送信者ラベルだけを狙う
page.locator('span.text-xs.font-medium.text-muted-foreground', {
  hasText: new RegExp(`^${name}$`),
})
```

```typescript
// デバッグオーバーレイのピアエントリだけを狙う
page.locator('ul li').filter({ hasText: name })
```

---

## 9. Playwright: メッセージ数カウントのセレクタ注意

### 症状
```typescript
// `.space-y-4 > div` はスクロール用の空 div も含む
await expect(page.locator('.space-y-4 > div')).toHaveCount(1);
// → 実際は 2（メッセージ1件 + scrollRef div）で失敗
```

### 対策
コンポーネントに `data-testid` を付けて明示的に識別する。

```tsx
// ChatPanel.tsx
<div data-testid="chat-message" className="...">
```

```typescript
// テスト側
await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(1);
```

---

## 10. カメラトラック切り替え（スクリーンシェア）

### 症状
スクリーン共有を開始・停止するとカメラ映像が復元されない。

### 原因
`stream.removeTrack(cameraTrack)` で取り除いた後、`cameraTrack` への参照を保持していないと `stopScreenShare` 時に元に戻せない。

### 対策
```typescript
const savedCameraTrackRef = useRef<MediaStreamTrack | null>(null);

// スクリーンシェア開始時
savedCameraTrackRef.current = cameraTrack; // 先に保存してから
stream.removeTrack(cameraTrack);
stream.addTrack(screenTrack);

// スクリーンシェア停止時
if (savedCameraTrackRef.current) {
  stream.addTrack(savedCameraTrackRef.current);
  savedCameraTrackRef.current = null;
}
```

---

## 11. シグナリングサーバーの URL をハードコードしない

### 問題
```typescript
const socket = io('http://localhost:4001'); // ハードコード
```
CI や本番では動かない。

### 対策
```typescript
const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL ?? 'http://localhost:4001');
```

`.env.local.example` に `NEXT_PUBLIC_SIGNALING_URL=http://localhost:4001` を記載してドキュメント化する。
