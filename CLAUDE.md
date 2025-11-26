# Misskey AI Assistant Bot

## プロジェクト概要

Misskeyインスタンス（中規模: 10人以上）向けAIアシスタントBot。
ローカルTLを監視し、AIが反応すべきと判断した投稿に返信する。

## 現在のフェーズ

**仕様策定フェーズ** - 実装は行わない

## 技術スタック

- **ランタイム**: Node.js + TypeScript
- **AI**: Claude API (`@anthropic-ai/sdk`) + Tool Use
- **Misskey**: misskey-js or 直接API
- **スケジューラ**: node-cron（定期）+ setTimeout（単発）
- **データ**: ファイルシステム（YAML/JSON/TXT）

## コア機能

1. **今北産業**: ユーザーの最終ノート以降のLTLを3行要約
2. **タスク管理**: todo.txt / backlog.txt の管理
3. **定期リマインド**: cron.txt で定期通知
4. **単発リマインド**: 「3時間後に〜」等の相対時間指定
5. **発言検索**: 「今日やるって言った発言まとめて」
6. **自由会話**: フレンドリーな口調での対話
7. **プロアクティブ反応**: AIが自発的に価値提供

## アーキテクチャ

```
Bot Process
├── Misskey Listener (Streaming API で監視)
├── Scheduler (node-cron + setTimeout)
└── Claude API + Tools
    ├── misskey_* (投稿、TL取得、リアクション)
    ├── file_* (ユーザーファイル読み書き)
    └── reminder_* / cron_* (リマインド管理)
```

## ファイル構造

```
shared/
└── personality.md          # AI人格設定（共通）

users/{userId}/
├── profile.yaml            # 基本情報、最終アクティブ時刻
├── knowledge.txt           # ユーザー専用知識 [固定テンプレ]
├── todo.txt                # タスク一覧 [固定テンプレ]
├── cron.txt                # 定期リマインド [固定テンプレ]
├── backlog.txt             # 保留タスク
├── pending.json            # 単発リマインド（システム用）
└── ...                     # 他はMCPで動的作成可能
```

- ユーザーが直接ファイル編集可能
- knowledge/todo/cron は固定テンプレとして用意

## Bot人格

- 口調: フレンドリー（タメ口）
- 性格: 気さくで頼りになる友達

## ドキュメント

```
docs/
├── requirements.md   # 要件定義
├── usecases.md       # ユースケース一覧
├── ux-design.md      # UX設計（人格、フロー、データ構造）
└── technical-spec.md # 技術仕様（Tool一覧、実装方針）
```

## 拡張性

- 現在: Claude API + Tool Use
- 将来: Claude Agent SDK + MCP に移行可能
- スキル追加は Tool / MCP Server として実装

## 未決定事項

- ユーザーファイルの編集方法（Git? Web UI?）
- 会話履歴の保持期間
- ホスティング環境
- エラー時のリトライ戦略

## 作業の進め方

1. ~~ニーズのヒアリング~~ 完了
2. ~~ユースケースの洗い出し~~ 完了
3. ~~UXフローの設計~~ 完了
4. ~~技術仕様の詳細化~~ 完了
5. 仕様レビュー・確定 ← 現在地
6. 実装開始

## コマンド

（実装フェーズになったら追記）
