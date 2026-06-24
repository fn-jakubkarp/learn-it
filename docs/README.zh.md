# Learn-it

> 一条让知识真正留存的 AI 学习流水线--间隔重复、主动回忆，以及一个无法作弊的掌握度评分。

<!-- README-I18N:START -->

[English](../README.md) | **中文** | [Español](./README.es.md) | [Polski](./README.pl.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md)

<!-- README-I18N:END -->

<p align="center">
  <img src="diag-teaser.gif" alt="learn-it 逐个概念诊断你，对每个概念评分，并生成关于你当前水平的校准报告" width="820">
</p>

识别不等于回忆。你看到答案时能认出它，却未必能在没有提示的情况下从记忆中把它调取出来。Learn-it 正是为第二种「知道」而生：它生成个性化的学习路径，再用经过验证的认知科学方法--间隔重复（FSRS）、主动回忆、Feynman 技巧、Bloom 深度，以及 Dreyfus 技能阶梯--驱动你，直到知识真正进入长期记忆。

它通过 `/learn-it` 技能由 AI 驱动。AI 负责诊断、讲解和评分；一个轻量的 Bun CLI 是它调用的引擎，只记录你实际展示出来的东西。

> [!NOTE]
> 掌握度**由记录下来的表现计算得出，绝不靠自我申报。** 为自己的分数作弊，恰恰就是这个工具要击败的「会了的错觉」--所以改动文件无法撼动它。

## 特性

- **个性化路线图**--诊断会评估你已经掌握的内容，并把一个主题拆分成概念大小的叶子节点，让你跳过已会的部分，也不会被认知超载。
- **概念级别的间隔重复**--每个*概念*（而非每张卡片）都有自己的 FSRS 调度，由你用来强化它的任意方式推进：重新讲解、测验、重读，或一张卡片。
- **多种途径的主动回忆**--卡片只是其中一条途径，并非全部。重新讲解（Feynman）、回答一道犀利的测验题，或完成一个小型的真实任务都算数；被动重读只被记为「识别」，绝不算作证明。
- **严苛、无法作弊的掌握度**--每个主题在 Dreyfus 阶梯上对应一个等级（`novice → … → expert`），由一份只追加的日志汇总而成，记录已评分的回忆与按评分量表打分的测评。数量永远无法抬升等级；`expert` 需要一次真实的构建外加随时间体现的持久性。
- **是观察者，不是轨道**--阶段是从真实状态*推断*出来的，从不存储。任何阶段都可按需运行；如果你跳步，观察者会提醒你，但把决定权交给你。
- **同时进行多个主题**--并行学 Rust、计算机网络和烹饪；复习队列会把所有主题中到期的内容交错安排。
- **本地 Web 仪表盘**--一个免构建的 `Bun.serve` 页面，位于 `localhost:4321`，供你在两次学习之间独自复习。

## 前置条件

- [Bun](https://bun.sh) ≥ 1.3--运行整个引擎（CLI、仪表盘、测试，以及内置的 SQLite）。无需 Node.js。
- `git`。
- 一个用来驱动它的智能体 CLI--推荐 [Claude Code](https://claude.com/claude-code)；该技能同样适配了 [Qwen Code](https://github.com/QwenLM/qwen-code)、[OpenCode](https://opencode.ai) 和 [Gemini CLI](https://github.com/google-gemini/gemini-cli)。

## 安装

一行命令会在需要时安装 Bun、克隆仓库、安装依赖，并创建数据库。

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.sh | bash
```

**Windows（PowerShell）**

```powershell
irm https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.ps1 | iex
```

<details>
<summary>或者手动安装</summary>

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git
cd learn-it
bun install
bun src/init-db.ts          # create data/learn_it.db
bun run verify              # optional: biome + tsc + bun test
```

</details>

<details>
<summary>安装时关闭遥测</summary>

在首次运行**之前**写入退出开关——Bun 会自动加载 `.env`，因此从第一条命令起遥测就处于关闭状态（不显示首次运行提示，也不会生成任何 id）。`.env` 已被 gitignore 忽略。

**Linux / macOS**

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git && cd learn-it
echo "LEARN_IT_TELEMETRY=0" > .env
bun install && bun src/init-db.ts
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/fn-jakubkarp/learn-it.git; cd learn-it
"LEARN_IT_TELEMETRY=0" | Out-File -Encoding ascii .env
bun install; bun src/init-db.ts
```

想要系统级开关？`export DO_NOT_TRACK=1` 会让本工具以及任何遵循[该标准](https://consoledonottrack.com)的工具都退出遥测。

</details>

## 用法

在**仓库目录内**打开你的智能体 CLI--引擎以仓库根目录作为工作目录运行--然后调用该技能。不带参数时它会显示横跨所有主题的仪表盘；带参数则指定一个阶段。Learn-it 的设计是由 AI 驱动，而非手动敲命令--整个循环是对话式的：诊断 → 交谈 → 规划 → 间隔化的再接触 → 验证。

```
/learn-it                   # dashboard across all subjects + the command menu
/learn-it init rust         # start a subject (just your goal — no self-inventory)
/learn-it explore-gaps rust # the diagnostic: it tests you and places you, you don't self-report
/learn-it reinforce         # the daily loop: spaced, varied re-exposure of due concepts
```

### 阶段

每个阶段都可按需运行--没有任何阻挡。`[subject]` 是可选的（省略时作用于所有主题）；`{…}` 是必填的。

**诊断与规划**

| 阶段 | 作用 |
| --- | --- |
| `/learn-it` | 启动仪表盘，然后打印横跨所有主题的状态与命令菜单。 |
| `init {subject} [slug]` | 搭建该主题的骨架，并记录你的**目标**（为什么 + 目标水平）。分配一个简短的 ascii **slug**（例如 `egzamin-krotkofalowca-klasa-1`）——这是你传给后续命令的稳定、引号安全的 id（完整名称也可用）。无需自我盘点——定位是测出来的，不是声明出来的。 |
| `explore-topic {subject}` | 把**整个**领域映射成概念并登记——覆盖来自该领域本身，而非你的回忆，因此未被你说出的空白也会落到图上。 |
| `explore-gaps {subject}` | 一次只探查一个概念（对线索作出反应，而非自由回忆），在每个空白处教一句话要点，并写出一份 🟢/🟡/🔴 的现状读数。设定一个 `target`。 |
| `plan {subject}` | 用探查结果校正概念图；按基础优先的顺序排列。 |

**学习与锚定**

| 阶段 | 作用 |
| --- | --- |
| `concept {term}` | 用类比 + 机理来讲解；你把它复述进 `notes.md`。 |
| `anchor {facts}` | 仅为原始事实（语法、名称、日期）做助记。 |
| `extract {subject}` | 把你的笔记转化为卡片。 |

**回忆与间隔**

| 阶段 | 作用 |
| --- | --- |
| `reinforce [subject]` | **每日循环**--对到期概念做间隔化、多样化的再接触，最薄弱的优先。 |
| `review [subject]` | 卡片回忆，评分，并在答错时给出反馈。 |
| `quiz {subject} {concept}` | 一道犀利的回忆/应用题。 |

**验证与评分**

| 阶段 | 作用 |
| --- | --- |
| `feynman {subject}` | 你把它讲回来；AI 探查漏洞 → 记录 `explain` 证据。 |
| `exam {subject}` | 用一道*全新*问题做硬核测试 → 记录 `apply` 证据。 |
| `assess {subject} [kind]` | 针对你的薄弱点，下发一个结构化的家庭任务（`explain`/`apply`/`build`）。 |
| `evaluate {subject} {kind} {0-100} [file]` | 按固定评分量表给一份提交打分（≥ 70 通过）并关闭该任务。 |
| `mastery {subject}` | 当前等级、距下一级的百分比，以及究竟是什么在阻挡它。 |

> [!NOTE]
> `build` 是里程碑式的类型：一个小而真实的产出物，在评分前会被反复追问。要拿到 `expert` 评级所需的证据，`build` 通过是唯一的途径。

要在两次学习之间独自复习，本地仪表盘无需 AI：

```bash
bun src/dashboard.ts        # → http://localhost:4321
```

> [!TIP]
> 要让 `/learn-it` 在任意项目中都可被发现，可以把它当作 Claude Code 插件安装：`/plugin marketplace add fn-jakubkarp/learn-it`，然后 `/plugin install learn-it@learn-it`。引擎仍然从克隆的仓库运行，所以请保留这份克隆。

> [!IMPORTANT]
> 裸的 `bun src/learn-it.ts <cmd>` 调用是该技能所驱动的引擎，并非手动工作流。只在检视或脚本化你的数据时才直接动用它们（`export`、`doctor`、`db`）。

## 工作原理

**两个层级。** 一个*主题（subject）*是你要掌握的东西（例如「Rust」），它承载路线图、阶段和 Dreyfus 等级。一个*概念（concept）*是它之下、课时大小的叶子节点（例如「ownership」）；卡片挂在这里。路线图就是概念清单，掌握度由它汇总而来--你不可能在单个事实上成为「专家」。

**阶段是地图，不是铁轨。** Learn-it 读取你的真实状态（概念映射了吗？*探查过了吗*？卡片复习了吗？）来推断每个主题所处的位置——当你被测试过后，diagnose 才会被甩在身后，而不是在你填完表单后。没有任何阻挡。

```
diagnose → conceptualize → recall → space → verify → mastered
```

**掌握度靠挣得，且与媒介无关。** 攀升一个等级需要经证实的留存（在真实的间隔之后、而非当天回忆出某个概念），外加并非来自卡片的证据--讲解它、把它应用到新问题，以及（对于 `expert`）构建出真实的东西。间隔计算的是真实流逝的时间，所以当天反复刷不会推动任何进展。

**测评是模板化的，不是即兴的。** `assess` 从固定模板下发一个任务；你提交；`evaluate` 按固定的评分量表给它打分，从而避免评分漂移。要拿到 `expert` 所需的证据，`build` 通过是唯一途径。

### 归属模型

| 关注点 | 归属 | 文件 |
| --- | --- | --- |
| **知识** | 你来撰写，引擎只读 | `subjects/<s>/{audit,notes,roadmap}.md`、`assessments/*.md` |
| **状态** | 引擎拥有，请勿手改 | `data/learn_it.db`（卡片、回忆日志、证据） |
| **引擎** | 受版本管理的逻辑 + 提示词 | `src/*.ts`、`stages/*.md`、`templates/*` |

唯一的规则：引擎写入*状态*，读取*知识*，绝不编辑由你撰写的文件。

### 引擎

| 文件 | 角色 |
| --- | --- |
| `src/learn-it.ts` | 会话路由：仪表盘、观察者、概念、卡片、assess/evaluate、掌握度、会话笔记、`export`、`doctor`。 |
| `src/lifecycle.ts` | 推断某个主题的阶段并给出建议（从不阻挡）。 |
| `src/scheduler.ts` | 卡片的 FSRS 内核；按真实流逝时间记录每一次回忆。 |
| `src/exposure.ts` | 概念级别的间隔接触（`reinforce` 队列），由任意途径推进。 |
| `src/mastery.ts` | Dreyfus 等级，在概念 + 证据上汇总（数量不计分）。 |
| `src/init-db.ts` | 创建 / 迁移 SQLite 架构。 |
| `src/dashboard.ts` | 免构建的本地 Web 仪表盘。 |
| `src/telemetry.ts` | 匿名、不含内容的使用情况遥测（可退出）。 |

完整设计（含整个流程的图示）参见 [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)。

## 遥测

Learn-it 会发送**匿名、不含内容**的使用情况遥测（PostHog），以便根据大家实际使用的命令来改进工具。首次发送任何数据时会打印一条醒目的一次性提示。

- **发送的内容：** 你运行的命令（`grade`、`assess` 等）、应用版本、操作系统，以及一个随机的每次安装 id。仪表盘不会被追踪。
- **绝不发送的内容：** 科目名、概念名、卡片内容、笔记、分数——任何你学习的东西。这些都留在你机器上的 `data/*.db` 中，绝不外传。
- **随时退出：** `export DO_NOT_TRACK=1`（[跨工具标准](https://consoledonottrack.com)）或 `export LEARN_IT_TELEMETRY=0`。CI 运行会被自动排除。匿名 id 位于 `data/.telemetry-id`——删除它即可重置。

## 致谢

技能路由器与各阶段的提示词脚手架受 [career-ops](https://github.com/santifer/career-ops)（MIT）启发。Learn-it 的方法论、调度引擎和领域逻辑均为原创。
