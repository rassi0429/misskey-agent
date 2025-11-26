# 技術仕様書

## 1. 技術スタック

| カテゴリ | 技術 | 用途 |
|----------|------|------|
| ランタイム | Node.js | Bot本体 |
| 言語 | TypeScript | 型安全な開発 |
| AI | Claude API (`@anthropic-ai/sdk`) | AI処理 |
| Misskey | Misskey.js or 直接API | Misskey連携 |
| スケジューラ | node-cron | 定期タスク |
| データ保存 | ファイルシステム (YAML/JSON) | ユーザープロファイル |

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     Misskey Instance                        │
│                      (Streaming API)                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Bot Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Misskey    │  │  Scheduler  │  │   Claude API        │  │
│  │  Listener   │  │  (node-cron)│  │   + Tool Use        │  │
│  │             │  │             │  │                     │  │
│  │  - 投稿監視  │  │  - 定期cron │  │  ┌───────────────┐  │  │
│  │  - 反応判断  │  │  - 単発     │  │  │    Tools      │  │  │
│  │             │  │    リマインド │  │  │  - misskey    │  │  │
│  └──────┬──────┘  └──────┬──────┘  │  │  - file       │  │  │
│         │                │         │  │  - reminder   │  │  │
│         └────────────────┴─────────┤  └───────────────┘  │  │
│                                    │                     │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ shared/          │  │ users/{userId}/                  │ │
│  │  └─personality.md│  │  ├─ profile.yaml                 │ │
│  │                  │  │  ├─ knowledge.txt                │ │
│  └──────────────────┘  │  ├─ todo.txt                     │ │
│                        │  ├─ cron.txt                     │ │
│                        │  ├─ backlog.txt                  │ │
│                        │  └─ pending.json (単発リマインド) │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 3. 必要な Tools (Claude API Tool Use)

### 3.1 Misskey 関連

| Tool名 | 説明 | パラメータ |
|--------|------|------------|
| `misskey_post_note` | ノートを投稿 | `text`, `visibility`, `replyId?` |
| `misskey_get_local_timeline` | ローカルTLを取得 | `since?`, `until?`, `limit?` |
| `misskey_get_user_notes` | ユーザーのノート取得 | `userId`, `since?`, `limit?` |
| `misskey_add_reaction` | リアクションを追加 | `noteId`, `reaction` |
| `misskey_get_note` | 特定ノートを取得 | `noteId` |

### 3.2 ファイル操作関連

| Tool名 | 説明 | パラメータ |
|--------|------|------------|
| `file_read` | ユーザーファイルを読む | `userId`, `filename` |
| `file_write` | ユーザーファイルに書く | `userId`, `filename`, `content` |
| `file_append` | ユーザーファイルに追記 | `userId`, `filename`, `content` |
| `file_list` | ユーザーのファイル一覧 | `userId` |
| `file_create` | 新規ファイル作成 | `userId`, `filename`, `content?` |

### 3.3 リマインダー関連

| Tool名 | 説明 | パラメータ |
|--------|------|------------|
| `reminder_set_relative` | N時間後にリマインド | `userId`, `delayMinutes`, `message` |
| `reminder_set_absolute` | 特定日時にリマインド | `userId`, `datetime`, `message` |
| `reminder_list` | リマインダー一覧 | `userId` |
| `reminder_cancel` | リマインダーキャンセル | `userId`, `reminderId` |
| `cron_add` | 定期リマインド追加 | `userId`, `schedule`, `message` |
| `cron_list` | 定期リマインド一覧 | `userId` |
| `cron_remove` | 定期リマインド削除 | `userId`, `cronId` |

### 3.4 ユーティリティ

| Tool名 | 説明 | パラメータ |
|--------|------|------------|
| `get_current_time` | 現在時刻を取得 | - |
| `parse_relative_time` | 「3時間後」を解析 | `text` |

## 4. ファイル構造詳細

### 4.1 共通設定

```
shared/
└── personality.md    # AI人格設定
```

```markdown
# personality.md
あなたは Misskey インスタンスのAIアシスタントです。

## 口調
- フレンドリーなタメ口で話す
- 絵文字は控えめに使う
- 親しみやすく、でも頼りになる友達のように

## 行動指針
- ユーザーの役に立つことを最優先
- 邪魔にならないよう配慮
- わからないことは正直に言う
```

### 4.2 ユーザープロファイル

```yaml
# users/{userId}/profile.yaml
user_id: "abc123xyz"
misskey_username: "@user"
preferred_name: "ユーザー"
last_active_note_id: "note_xxx"
last_active_at: "2024-01-15T10:30:00Z"
created_at: "2024-01-01T00:00:00Z"
settings:
  notification_level: "normal"  # quiet / normal / active
```

### 4.3 ToDo

```
# users/{userId}/todo.txt
- [ ] レポート提出 (due: 2024-01-20)
- [ ] 買い物
- [x] 歯医者予約
```

### 4.4 Cron（定期タスク）

```
# users/{userId}/cron.txt
# format: <cron式> | <メッセージ>
0 9 * * * | 水飲んで！
0 22 * * 0 | 明日の準備は大丈夫？
```

### 4.5 Knowledge（ユーザー専用知識）

```
# users/{userId}/knowledge.txt
- 好きな食べ物: ラーメン
- 仕事: エンジニア
- 趣味: ゲーム、アニメ
- 苦手: 早起き
```

### 4.6 Pending（単発リマインド）

```json
// users/{userId}/pending.json
{
  "reminders": [
    {
      "id": "rem_001",
      "message": "薬を飲む",
      "executeAt": 1705312800000,
      "createdAt": 1705302000000
    }
  ]
}
```

## 5. 定時タスク実装

### 5.1 定期タスク（node-cron）

```typescript
import cron from 'node-cron';

interface CronJob {
  schedule: string;
  message: string;
}

// 起動時にユーザーのcron.txtを読み込み
function initUserCrons() {
  const users = getAllUserIds();

  users.forEach(userId => {
    const jobs = parseCronFile(`users/${userId}/cron.txt`);
    jobs.forEach(job => {
      cron.schedule(job.schedule, () => {
        sendReminder(userId, job.message);
      });
    });
  });
}
```

### 5.2 単発リマインド（setTimeout + 永続化）

```typescript
interface PendingReminder {
  id: string;
  message: string;
  executeAt: number;
  createdAt: number;
}

// リマインド設定
function setReminder(userId: string, delayMs: number, message: string) {
  const reminder: PendingReminder = {
    id: generateId(),
    message,
    executeAt: Date.now() + delayMs,
    createdAt: Date.now()
  };

  // ファイルに保存
  appendToPendingFile(userId, reminder);

  // タイマー設定
  setTimeout(() => {
    sendReminder(userId, reminder.message);
    removeFromPending(userId, reminder.id);
  }, delayMs);
}

// 起動時に復元
function restorePendingReminders() {
  const users = getAllUserIds();

  users.forEach(userId => {
    const pending = loadPendingFile(userId);

    pending.reminders.forEach(r => {
      const delay = r.executeAt - Date.now();

      if (delay > 0) {
        // 未来のリマインドはタイマー設定
        setTimeout(() => {
          sendReminder(userId, r.message);
          removeFromPending(userId, r.id);
        }, delay);
      } else {
        // 過ぎてたら即実行
        sendReminder(userId, `（遅れてごめん）${r.message}`);
        removeFromPending(userId, r.id);
      }
    });
  });
}
```

## 6. 反応判断フロー

```typescript
async function handleNote(note: Note) {
  // 1. プライベートはスキップ
  if (note.visibility === 'specified') return;

  // 2. ユーザープロファイル取得/作成
  const profile = await getOrCreateProfile(note.userId);

  // 3. 最終アクティブ更新
  await updateLastActive(note.userId, note.id);

  // 4. AIに判断させる
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    system: loadPersonality() + loadUserKnowledge(note.userId),
    tools: ALL_TOOLS,
    messages: [{
      role: "user",
      content: `
        以下の投稿に反応すべきか判断し、必要なら返信してください。

        投稿者: ${note.user.name}
        内容: ${note.text}

        反応が不要なら何もしないでください。
      `
    }]
  });

  // 5. Tool呼び出しを処理
  await processToolCalls(response);
}
```

## 7. 将来の拡張（MCP移行）

現在の Tool Use から MCP への移行パス：

```
現在: Claude API + Tool Use (関数直接定義)
  ↓
将来: Claude Agent SDK + MCP Servers

┌─────────────────────────────────────────┐
│           Bot (Agent SDK)               │
└───────────────┬─────────────────────────┘
                │ MCP Protocol
    ┌───────────┼───────────┬─────────────┐
    ▼           ▼           ▼             ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│Misskey │ │ File   │ │ Reminder │ │ 新スキル │
│ MCP    │ │ MCP    │ │ MCP      │ │ (後から) │
└────────┘ └────────┘ └──────────┘ └──────────┘
```

## 8. 依存パッケージ（予定）

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.x.x",
    "misskey-js": "^0.x.x",
    "node-cron": "^3.x.x",
    "yaml": "^2.x.x",
    "uuid": "^9.x.x"
  },
  "devDependencies": {
    "typescript": "^5.x.x",
    "@types/node": "^20.x.x",
    "@types/node-cron": "^3.x.x"
  }
}
```

## 9. 未決定事項

- [ ] Misskey APIのレート制限対応
- [ ] エラー時のリトライ戦略
- [ ] ログ出力形式・保存先
- [ ] ユーザーファイルの直接編集方法（Git? Web UI?）
- [ ] 会話履歴の保持（どこまで？ファイル？）
- [ ] Bot自体のホスティング環境
