# Learn-it

> 知識を本当に定着させる AI 学習パイプライン--間隔反復、能動的想起、そしてごまかせない習熟度スコア。

<!-- README-I18N:START -->

[English](./README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [Polski](./README.pl.md) | **日本語** | [Deutsch](./README.de.md)

<!-- README-I18N:END -->

再認は想起ではありません。答えを見れば「分かる」のに、手がかりなしに記憶から引き出せないことがあります。Learn-it は後者の「知っている」状態のために作られています。個別化された学習経路を生成し、実証済みの認知科学の手法--間隔反復（FSRS）、能動的想起、Feynman テクニック、Bloom の深さ、Dreyfus の技能ラダー--を通してあなたを導き、知識が本当に長期記憶へ定着するまで連れて行きます。

`/learn-it` スキルを通じて AI が駆動します。AI が診断し、教え、採点します。軽量な Bun の CLI はそれが呼び出すエンジンであり、あなたが実際に示したことだけを記録します。

> [!NOTE]
> 習熟度は**記録された成績から計算され、自己申告は一切されません。** 自分のスコアをごまかすことこそ、このツールが打ち破ろうとしている「できているという錯覚」です--だからファイルを編集してもスコアは動きません。

## 特長

- **個別化されたロードマップ**--診断であなたが既に知っていることを評価し、科目を概念サイズの葉に分解します。習得済みの部分は飛ばせ、認知的に過負荷になりません。
- **概念単位の間隔反復**--各*概念*（カードごとではなく）が独自の FSRS スケジュールを持ち、それを強化するあらゆる手段--再説明、クイズ、再読、またはカード--で進みます。
- **多様な経路での能動的想起**--カードは一つの経路であって、目的ではありません。再説明（Feynman）、鋭いクイズへの解答、小さな実タスクの遂行はすべてカウントされます。受動的な再読は再認としてのみ記録され、証明には決してなりません。
- **厳しく、ごまかせない習熟度**--科目ごとの Dreyfus 段階（`novice → … → expert`）で、採点された想起とルーブリックで採点された評価の追記専用ログから積み上がります。量で段階は決して上がりません。`expert` には本物のビルドに加え、時間をかけた持続性が必要です。
- **監視役であって、レールではない**--フェーズは実際の状態から*推論*され、保存されることはありません。どの段階も必要に応じて実行できます。先走っても監視役が助言し、決定はあなたに委ねます。
- **複数科目を同時に**--Rust、コンピュータネットワーク、料理を並行で進められます。復習キューはすべての科目の期限到来分を交互に出します。
- **ローカル Web ダッシュボード**--`localhost:4321` のビルド不要な `Bun.serve` ページで、セッションの合間に一人で復習できます。

## 前提条件

- [Bun](https://bun.sh) ≥ 1.3--エンジン全体（CLI、ダッシュボード、テスト、同梱の SQLite）を実行します。Node.js は不要です。
- `git`。
- 駆動用のエージェント CLI--[Claude Code](https://claude.com/claude-code) を推奨。スキルは [Qwen Code](https://github.com/QwenLM/qwen-code)、[OpenCode](https://opencode.ai)、[Gemini CLI](https://github.com/google-gemini/gemini-cli) 向けにも組み込まれています。

## インストール

ワンライナーは必要に応じて Bun をインストールし、リポジトリをクローンし、依存関係をインストールし、データベースを作成します。

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.sh | bash
```

**Windows（PowerShell）**

```powershell
irm https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.ps1 | iex
```

<details>
<summary>または手動でインストール</summary>

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git
cd learn-it
bun install
bun src/init-db.ts          # create data/learn_it.db
bun run verify              # optional: biome + tsc + bun test
```

</details>

## 使い方

エージェント CLI を**リポジトリ内で**開き--エンジンはリポジトリのルートを作業ディレクトリとして実行されます--スキルを呼び出します。引数なしならすべての科目のダッシュボードを表示し、引数があれば段階を指定します。Learn-it は手で打ち込むのではなく AI が駆動するように作られています--ループは対話的です：診断 → 対話 → 計画 → 間隔を空けた再接触 → 検証。

```
/learn-it                   # dashboard across all subjects + the command menu
/learn-it init rust         # start a subject (fill its audit.md)
/learn-it plan rust         # turn the audit into a roadmap of concepts
/learn-it reinforce         # the daily loop: spaced, varied re-exposure of due concepts
```

### 段階

どの段階も必要に応じて実行でき、何もブロックされません。`[subject]` は省略可能（省略時はすべての科目に作用）、`{…}` は必須です。

**診断と計画**

| 段階 | 何をするか |
| --- | --- |
| `/learn-it` | ダッシュボードを起動し、すべての科目の状態とコマンドメニューを表示します。 |
| `init {subject}` | 科目の雛形を作成し、記入用に `audit.md` を開きます。 |
| `explore-topic {subject}` | 候補となる概念マップを下書きして登録します。 |
| `explore-gaps {subject}` | 概念を一つずつ探り、あなたを実際のレベルに位置づけ、`target` を設定します。 |
| `plan {subject}` | 探りの結果とマップをすり合わせ、基礎優先で並べます。 |

**学習と定着**

| 段階 | 何をするか |
| --- | --- |
| `concept {term}` | 類推＋仕組みで教えます。あなたはそれを `notes.md` に言い換えて書きます。 |
| `anchor {facts}` | 生の事実（構文、名前、日付）にだけ記憶術を施します。 |
| `extract {subject}` | あなたのノートをカードに変換します。 |

**想起と間隔**

| 段階 | 何をするか |
| --- | --- |
| `reinforce [subject]` | **毎日のループ**--期限到来の概念に対する、間隔を空けた多様な再接触。弱いものから先に。 |
| `review [subject]` | カードによる想起。採点され、誤答時にフィードバックがあります。 |
| `quiz {subject} {concept}` | 鋭い想起／応用の問題を一問。 |

**検証と採点**

| 段階 | 何をするか |
| --- | --- |
| `feynman {subject}` | あなたが教え返します。AI が穴を探り → `explain` の証拠を記録します。 |
| `exam {subject}` | *新しい*問題での難しいテスト → `apply` の証拠を記録します。 |
| `assess {subject} [kind]` | あなたの弱点に狙いを定めた、構造化された宿題（`explain`/`apply`/`build`）を発行します。 |
| `evaluate {subject} {kind} {0-100} [file]` | 提出物を固定ルーブリックで採点（≥ 70 で合格）し、タスクを閉じます。 |
| `mastery {subject}` | 現在の段階、次の段階までの %、そして何が正確にそれを妨げているか。 |

> [!NOTE]
> `build` はマイルストーン型です：小さくとも本物の成果物で、採点前に問い詰められます。`expert` 評価に必要な証拠への唯一の道は、合格した `build` です。

セッションの合間に一人で復習するには、ローカルのダッシュボードに AI は不要です：

```bash
bun src/dashboard.ts        # → http://localhost:4321
```

> [!TIP]
> `/learn-it` をどのプロジェクトからも見つけられるようにするには、Claude Code プラグインとしてインストールします：`/plugin marketplace add fn-jakubkarp/learn-it` の後に `/plugin install learn-it@learn-it`。エンジンは引き続きクローンしたリポジトリから実行されるので、クローンは残しておいてください。

> [!IMPORTANT]
> 素の `bun src/learn-it.ts <cmd>` 呼び出しは、スキルが駆動するエンジンであって、手動のワークフローではありません。データを点検したりスクリプト処理したりする場合にのみ直接使ってください（`export`、`doctor`、`db`）。

## 仕組み

**二つの階層。** *科目（subject）*はあなたが習得する対象（例：「Rust」）で、ロードマップ、フェーズ、Dreyfus 段階を担います。*概念（concept）*はその下にあるレッスンサイズの葉（例：「ownership」）で、カードはここに紐づきます。ロードマップは概念のリストであり、習熟度はそこから積み上がります--単一の事実で「エキスパート」にはなれません。

**フェーズは地図であって、線路ではありません。** Learn-it はあなたの実際の状態（監査は記入済みか？概念は計画済みか？カードは復習済みか？）を読み、各科目がどこにあるかを推論します。何もブロックされません。

```
diagnose → conceptualize → recall → space → verify → mastered
```

**習熟度は勝ち取るもので、媒体に依存しません。** 段階を上がるには、証明された保持（同じ日ではなく、実際の間隔を空けて概念を想起すること）に加え、カード以外の証拠--説明すること、新しい問題に応用すること、そして `expert` には本物の何かを構築すること--が必要です。間隔は実際に経過した時間を数えるので、同じ日に詰め込んでも何も進みません。

**評価はテンプレート化されており、即興ではありません。** `assess` は固定テンプレートからタスクを発行し、あなたが提出し、`evaluate` が固定ルーブリックで採点して採点のぶれを防ぎます。`expert` に必要な証拠への唯一の道は、合格した `build` です。

### 所有モデル

| 関心事 | 所有者 | ファイル |
| --- | --- | --- |
| **知識** | あなたが書き、エンジンは読むだけ | `subjects/<s>/{audit,notes,roadmap}.md`、`assessments/*.md` |
| **状態** | エンジンが所有、手で編集しない | `data/learn_it.db`（カード、想起ログ、証拠） |
| **エンジン** | バージョン管理されたロジック＋プロンプト | `src/*.ts`、`stages/*.md`、`templates/*` |

唯一のルール：エンジンは*状態*を書き、*知識*を読み、あなたが書いたファイルは決して編集しません。

### エンジン

| ファイル | 役割 |
| --- | --- |
| `src/learn-it.ts` | セッションルーター：ダッシュボード、監視役、概念、カード、assess/evaluate、習熟度、セッションノート、`export`、`doctor`。 |
| `src/lifecycle.ts` | 科目のフェーズを推論し助言する（決してブロックしない）。 |
| `src/scheduler.ts` | カード用の FSRS コア。各想起を実際に経過した時間に対して記録する。 |
| `src/exposure.ts` | 概念単位の間隔接触（`reinforce` キュー）。あらゆる手段で進む。 |
| `src/mastery.ts` | Dreyfus 段階。概念＋証拠で積み上げる（量は加点しない）。 |
| `src/init-db.ts` | SQLite スキーマを作成／移行する。 |
| `src/dashboard.ts` | ビルド不要のローカル Web ダッシュボード。 |

完全な設計は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) を参照してください。

## 謝辞

スキルルーターと段階ごとのプロンプトの足場は [career-ops](https://github.com/santifer/career-ops)（MIT）から着想を得ています。Learn-it の方法論、スケジューリングエンジン、ドメインロジックは独自のものです。
