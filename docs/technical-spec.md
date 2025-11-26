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

## 6. コスト最適化（多段フィルタリング）

全投稿をClaude APIに投げるとコストが膨大になるため、多段フィルタで処理対象を絞る。

### 6.1 フィルタリングアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    全投稿 (100%)                            │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: ローカルフィルタ (コスト: $0)                      │
│  - メンションあり → 通過                                     │
│  - キーワードマッチ → 通過                                   │
│  - 疑問文パターン → 通過                                     │
│  - それ以外 → 破棄                                          │
│                                        除外率: ~90%         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼ (~10%)
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: 軽量LLM判断 (コスト: 低)                           │
│  選択肢:                                                    │
│  - Option A: ローカルLLM (Ollama) → $0                      │
│  - Option B: Claude Haiku 3 → $0.25/1M tokens               │
│                                                             │
│  「この投稿に反応すべき？ Yes/No」                            │
│                                        除外率: ~70%         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼ (~3%)
┌─────────────────────────────────────────────────────────────┐
│  Stage 3: Claude Sonnet で返信生成 (コスト: 高)              │
│  - Tool Use で実際のアクション実行                           │
│  - $3/1M input, $15/1M output                               │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Stage 1: ローカルフィルタ（ルールベース）

```typescript
const KEYWORDS = [
  '今北産業', 'タスク', 'リマインド', 'やらなきゃ',
  '教えて', 'todo', '追加', '完了'
];

function shouldPassToLLM(note: Note, botUserId: string): boolean {
  // メンションは必ず通過
  if (note.mentions?.includes(botUserId)) return true;

  // キーワードマッチ
  if (KEYWORDS.some(k => note.text?.toLowerCase().includes(k))) return true;

  // 疑問文パターン
  if (note.text?.match(/[?？]$|教えて|どう|なに|いつ/)) return true;

  // Botへの返信
  if (note.replyId && isMyNote(note.replyId)) return true;

  return false;
}
```

### 6.3 Stage 2: 軽量LLM判断

#### Option A: ローカルLLM（Ollama）- コスト$0

```typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

async function shouldRespondLocal(note: Note): Promise<boolean> {
  const response = await ollama.chat({
    model: 'tinyllama',  // 1.1B params, 軽量
    messages: [{
      role: 'user',
      content: `
以下の投稿にAIアシスタントとして反応すべきか判断してください。
"Yes" か "No" のみで答えてください。

投稿: "${note.text}"
`
    }]
  });

  return response.message.content.toLowerCase().includes('yes');
}
```

**推奨ローカルモデル:**

| モデル | サイズ | 用途 | 必要VRAM |
|--------|--------|------|----------|
| TinyLlama | 1.1B | 超軽量、判断用 | ~1GB |
| Phi-3 Mini | 3.8B | バランス良い | ~3GB |
| Gemma 2B | 2B | Google製、高品質 | ~2GB |
| Qwen2 1.5B | 1.5B | 日本語対応 | ~1.5GB |

```bash
# Ollama でモデル取得
ollama pull tinyllama
ollama pull qwen2:1.5b
```

#### Option B: Claude Haiku 3 - 低コスト

```typescript
async function shouldRespondHaiku(note: Note): Promise<boolean> {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `投稿: "${note.text}"\n\nこの投稿にAIアシスタントとして反応すべき？ YesかNoのみで回答。`
    }]
  });

  return response.content[0].text.toLowerCase().includes('yes');
}
```

### 6.4 コスト比較（1日100投稿の場合）

| 構成 | 月額コスト | 備考 |
|------|-----------|------|
| 全部Sonnet | ~$10 | 非推奨 |
| ローカルフィルタ + Sonnet | ~$3 | シンプル |
| ローカルフィルタ + Haiku + Sonnet | ~$0.40 | バランス良い |
| ローカルフィルタ + Ollama + Sonnet | ~$0.30 | 最安（要GPU） |
| バッチAPI利用時 | 上記の50% | 24時間以内処理でOKなら |

### 6.5 推奨構成

```
開発/テスト環境: ローカルフィルタ + Ollama (TinyLlama)
本番環境(GPU有): ローカルフィルタ + Ollama (Qwen2) + Sonnet
本番環境(GPU無): ローカルフィルタ + Haiku 3 + Sonnet
```

### 6.6 依存パッケージ（Ollama使用時）

```json
{
  "dependencies": {
    "ollama": "^0.5.x"
  }
}
```

## 7. 反応判断フロー（多段フィルタ適用版）

```typescript
async function handleNote(note: Note) {
  // 1. プライベートはスキップ
  if (note.visibility === 'specified') return;

  // 2. Stage 1: ローカルフィルタ
  if (!shouldPassToLLM(note, BOT_USER_ID)) {
    return; // 90%はここで終了
  }

  // 3. ユーザープロファイル取得/作成
  const profile = await getOrCreateProfile(note.userId);

  // 4. 最終アクティブ更新
  await updateLastActive(note.userId, note.id);

  // 5. Stage 2: 軽量LLM判断
  const shouldRespond = await shouldRespondLocal(note); // or shouldRespondHaiku
  if (!shouldRespond) {
    return; // さらに70%を除外
  }

  // 6. Stage 3: Sonnet で返信生成
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    system: loadPersonality() + loadUserKnowledge(note.userId),
    tools: ALL_TOOLS,
    messages: [{
      role: "user",
      content: `
        以下の投稿に返信してください。

        投稿者: ${note.user.name}
        内容: ${note.text}
      `
    }]
  });

  // 7. Tool呼び出しを処理
  await processToolCalls(response);
}
```

## 8. 将来の拡張（MCP移行）

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

## 9. 依存パッケージ（予定）

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

## 10. 未決定事項

- [ ] Misskey APIのレート制限対応
- [ ] エラー時のリトライ戦略
- [ ] ログ出力形式・保存先
- [ ] ユーザーファイルの直接編集方法（Git? Web UI?）
- [ ] 会話履歴の保持（どこまで？ファイル？）
- [ ] Bot自体のホスティング環境
